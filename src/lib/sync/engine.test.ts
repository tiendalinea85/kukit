import "fake-indexeddb/auto";
import { describe, beforeEach, it } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db.ts";
import { createSyncEngine } from "./engine.ts";
import { enqueueOperation, countOutbox } from "./outbox.ts";
import { runPull } from "./pull.ts";
import type { OutboxOperation, SyncErrorInfo, SyncTransportEntity } from "../../types/sync.ts";
import type { Expense } from "../../types/index.ts";

const T0 = "2026-01-01T00:00:00.000Z";

function makeExpense(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    code: `EXP-${id}`,
    description: "Gasto de prueba",
    amount: 10,
    categoryId: "cat-1",
    paymentMethod: "efectivo",
    status: "pagado",
    date: "2026-01-01",
    time: "10:00",
    notes: "",
    voidedAt: null,
    createdAt: T0,
    updatedAt: T0,
    deleted: false,
    syncStatus: "pending",
    ...overrides,
  };
}

async function addExpense(id: string, overrides: Record<string, unknown> = {}): Promise<void> {
  await db.expenses.add(makeExpense(id, overrides) as unknown as Expense);
}

async function seedExpense(id: string, overrides: Record<string, unknown> = {}, now = T0): Promise<OutboxOperation> {
  return enqueueOperation({ entity: "expenses", entityId: id, op: "upsert", payload: makeExpense(id, overrides), now });
}

// ---- Transporte y servidor simulados ---------------------------------------

class FakeServer {
  rows = new Map<string, Record<string, unknown>>();
  queue: Array<SyncErrorInfo | "throw" | null> = [];
  pushCalls = 0;
  pullCalls = 0;

  async push(op: OutboxOperation): Promise<SyncErrorInfo | null> {
    this.pushCalls++;
    const err = this.queue.shift() ?? null;
    if (err === "throw") throw new Error("boom");
    if (err) return err;
    const row = { ...op.payload };
    delete row.syncStatus;
    this.rows.set(op.entityId, row);
    return null;
  }

  async pull(since: string): Promise<{ rows: Array<Record<string, unknown>>; watermark: string | null }> {
    this.pullCalls++;
    const rows = [...this.rows.values()].filter((r) => String(r.updatedAt ?? "") > since);
    return { rows, watermark: `wm-${this.pullCalls}` };
  }
}

function makeTransport(server: FakeServer): SyncTransportEntity[] {
  return [
    {
      name: "expenses",
      serverTable: "expenses",
      order: 1,
      push: (op) => server.push(op),
      pull: (since) => server.pull(since),
    },
  ];
}

function makeConnection(initialOnline = true) {
  let online = initialOnline;
  const listeners = new Set<(s: { online: boolean; checkedAt: string | null; latencyMs: number | null }) => void>();
  const mon = {
    start() {},
    stop() {},
    getState: () => ({ online, checkedAt: null, latencyMs: null }),
    onChange: (cb: (s: { online: boolean; checkedAt: string | null; latencyMs: number | null }) => void) => {
      listeners.add(cb);
      cb(mon.getState());
      return () => listeners.delete(cb);
    },
    setOnline(v: boolean) {
      online = v;
      for (const cb of listeners) cb(mon.getState());
    },
  };
  return mon;
}

function buildEngine(server: FakeServer, opts: { online?: boolean } = {}) {
  const scheduled: Array<{ fn: () => void; ms: number }> = [];
  const engine = createSyncEngine({
    transport: makeTransport(server),
    connection: makeConnection(opts.online ?? true),
    autoSyncIntervalMs: 60_000,
    setTimeoutImpl: ((fn: () => void, ms: number) => {
      scheduled.push({ fn, ms });
      return scheduled.length;
    }) as typeof setTimeout,
    clearTimeoutImpl: (() => {}) as typeof clearTimeout,
  });
  return { engine, server, scheduled };
}

// ---- Tests ------------------------------------------------------------------

describe("engine: sin conexión", () => {
  beforeEach(async () => {
    await Promise.all([db.syncOutbox.clear(), db.syncLog.clear(), db.syncState.clear(), db.expenses.clear()]);
  });

  it("no empuja nada y deja las operaciones pendientes", async () => {
    const server = new FakeServer();
    const { engine } = buildEngine(server, { online: false });
    await seedExpense("e-1");
    await engine.runSync();

    assert.equal(server.pushCalls, 0);
    assert.equal(engine.getSnapshot().status, "offline");
    assert.equal(engine.getSnapshot().pendingCount, 1);

    const op = await db.syncOutbox.where("entityId").equals("e-1").first();
    assert.equal(op?.state, "pending");
  });
});

describe("engine: error de servidor y reintento (red intermitente)", () => {
  beforeEach(async () => {
    await Promise.all([db.syncOutbox.clear(), db.syncLog.clear(), db.syncState.clear(), db.expenses.clear()]);
  });

  it("falla con backoff y luego sincroniza sin duplicar", async () => {
    const server = new FakeServer();
    server.queue.push({ type: "server", message: "error 500", retryable: true });
    const { engine } = buildEngine(server);

    await addExpense("e-1");
    await seedExpense("e-1");
    await engine.runSync();

    let snap = engine.getSnapshot();
    assert.equal(snap.status, "error");
    assert.equal(snap.failedCount, 1);
    let op = (await db.syncOutbox.where("entityId").equals("e-1").first())!;
    assert.equal(op.state, "failed");
    assert.equal(op.attempts, 1);
    assert.ok(op.retryAt, "debe programar reintento");
    assert.equal(server.rows.size, 0);

    // El transporte se "recupera" y reintentamos manualmente.
    await engine.retryFailedNow();

    snap = engine.getSnapshot();
    assert.equal(snap.status, "synced");
    assert.equal(snap.failedCount, 0);
    assert.equal(server.rows.size, 1);
    assert.equal(server.pushCalls, 2);
    op = (await db.syncOutbox.where("entityId").equals("e-1").first())!;
    assert.equal(op.state, "synced");
    assert.equal((await db.expenses.get("e-1"))!.syncStatus, "synced");
  });
});

describe("engine: sin duplicados en reintentos", () => {
  beforeEach(async () => {
    await Promise.all([db.syncOutbox.clear(), db.syncLog.clear(), db.syncState.clear(), db.expenses.clear()]);
  });

  it("dos pasadas exitosas producen una sola fila en el servidor", async () => {
    const server = new FakeServer();
    const { engine } = buildEngine(server);

    await seedExpense("e-1");
    await engine.runSync();
    assert.equal(server.rows.size, 1);
    assert.equal(server.pushCalls, 1);

    await engine.runSync();
    assert.equal(server.rows.size, 1);
    assert.equal(server.pushCalls, 1);
    assert.equal((await countOutbox()).pending, 0);
  });
});

describe("engine: reconciliación de pendientes", () => {
  beforeEach(async () => {
    await Promise.all([db.syncOutbox.clear(), db.syncLog.clear(), db.syncState.clear(), db.expenses.clear()]);
  });

  it("encola y envía registros pending sin operación en el outbox", async () => {
    const server = new FakeServer();
    const { engine } = buildEngine(server);

    await addExpense("e-1");
    await engine.runSync();

    assert.equal(server.pushCalls, 1);
    assert.equal(server.rows.has("e-1"), true);
    const op = await db.syncOutbox.where("entityId").equals("e-1").first();
    assert.equal(op?.state, "synced");
    assert.equal((await db.expenses.get("e-1"))!.syncStatus, "synced");
  });
});

describe("engine: conflicto en push", () => {
  beforeEach(async () => {
    await Promise.all([db.syncOutbox.clear(), db.syncLog.clear(), db.syncState.clear(), db.expenses.clear()]);
  });

  it("marca la operación como conflicto y expone error", async () => {
    const server = new FakeServer();
    server.queue.push({ type: "conflict", message: "versión remota más nueva", retryable: false });
    const { engine } = buildEngine(server);

    await addExpense("e-1");
    await seedExpense("e-1");
    await engine.runSync();

    const snap = engine.getSnapshot();
    assert.equal(snap.status, "error");
    assert.equal(snap.conflictCount, 1);
    const op = (await db.syncOutbox.where("entityId").equals("e-1").first())!;
    assert.equal(op.state, "conflict");
    assert.equal((await db.expenses.get("e-1"))!.syncStatus, "conflict");
  });
});

describe("engine: recuperación tras cierre de app durante el sync", () => {
  beforeEach(async () => {
    await Promise.all([db.syncOutbox.clear(), db.syncLog.clear(), db.syncState.clear(), db.expenses.clear()]);
  });

  it("recupera operaciones estancadas en syncing", async () => {
    const server = new FakeServer();
    const { engine } = buildEngine(server);

    await addExpense("e-1", { syncStatus: "syncing" });
    const op = await seedExpense("e-1");
    await db.syncOutbox.update(op.id, { state: "syncing", lastAttemptAt: "2020-01-01T00:00:00.000Z" });

    await engine.runSync();

    assert.equal(server.rows.size, 1);
    const after = (await db.syncOutbox.get(op.id))!;
    assert.equal(after.state, "synced");
    assert.equal(engine.getSnapshot().status, "synced");
  });
});

describe("pull: conflicto con registro local pendiente", () => {
  beforeEach(async () => {
    await Promise.all([db.syncOutbox.clear(), db.syncLog.clear(), db.syncState.clear(), db.expenses.clear()]);
  });

  it("conserva el local y marca conflicto cuando el remoto es más nuevo", async () => {
    const server = new FakeServer();
    server.rows.set(
      "e-1",
      makeExpense("e-1", { updatedAt: "2026-02-01T00:00:00.000Z", revision: 1, syncStatus: undefined }),
    );

    await addExpense("e-1", { updatedAt: "2026-01-01T00:00:00.000Z", revision: 1 });
    const op = await seedExpense("e-1", { updatedAt: "2026-01-01T00:00:00.000Z", revision: 1 });

    const result = await runPull(makeTransport(server), { now: T0 });

    assert.equal(result.conflicts, 1);
    assert.equal((await db.expenses.get("e-1"))!.syncStatus, "conflict");
    const after = (await db.syncOutbox.get(op.id))!;
    assert.equal(after.state, "conflict");
  });
});
