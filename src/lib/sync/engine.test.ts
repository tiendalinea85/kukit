import "fake-indexeddb/auto";
import { describe, beforeEach, it } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db.ts";
import { createSyncEngine } from "./engine.ts";
import { enqueueOperation, countOutbox } from "./outbox.ts";
import { classifySyncError } from "./errors.ts";
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
  /** Se ejecuta ya dentro del vuelo, entre el claim y el completeOperation. */
  duringPush: ((op: OutboxOperation) => void | Promise<void>) | null = null;

  async push(op: OutboxOperation): Promise<SyncErrorInfo | null> {
    this.pushCalls++;
    const err = this.queue.shift() ?? null;
    if (err === "throw") throw new Error("boom");
    if (err) return err;
    const row = { ...op.payload };
    delete row.syncStatus;
    this.rows.set(op.entityId, row);
    if (this.duringPush) {
      const hook = this.duringPush;
      this.duringPush = null;
      await hook(op);
    }
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

describe("engine: edición posterior al primer push", () => {
  beforeEach(async () => {
    await Promise.all([db.syncOutbox.clear(), db.syncLog.clear(), db.syncState.clear(), db.expenses.clear()]);
  });

  it("la segunda edición sí llega al servidor (reconcile refresca el payload)", async () => {
    const server = new FakeServer();
    const { engine } = buildEngine(server);

    await addExpense("e-1");
    await engine.runSync();

    assert.equal(server.pushCalls, 1);
    assert.equal((await db.expenses.get("e-1"))!.syncStatus, "synced");

    // Edición posterior: los servicios solo marcan syncStatus, no encolan nada.
    await db.expenses.update("e-1", {
      amount: 500,
      updatedAt: "2026-01-01T02:00:00.000Z",
      syncStatus: "pending",
    });
    await engine.runSync();

    assert.equal(server.pushCalls, 2, "la segunda edición genera otro push");
    assert.equal(
      (server.rows.get("e-1") as { amount: number }).amount,
      500,
      "el servidor recibe la versión actual, no la primera",
    );
    assert.equal((await db.expenses.get("e-1"))!.syncStatus, "synced");
  });

  it("una edición hecha durante el push no se pierde (CAS en completeOperation)", async () => {
    const server = new FakeServer();
    const { engine } = buildEngine(server);

    await addExpense("e-1");
    const op = await seedExpense("e-1");

    // Edición B hecha DURANTE el vuelo de A (después del claim, antes del
    // complete), sin pasar por enqueueOperation.
    server.duringPush = async () => {
      await db.expenses.update("e-1", {
        amount: 500,
        updatedAt: "2026-01-01T00:30:00.000Z",
        syncStatus: "pending",
      });
    };
    await engine.runSync();

    // El CAS detecta la edición, re-encola con el payload de la fila y el
    // MISMO ciclo de push vuelve a reclamar → B no se pierde.
    assert.equal(server.pushCalls, 2, "A una vez y la edición B otra");
    assert.equal(
      (server.rows.get("e-1") as { amount: number }).amount,
      500,
      "el servidor termina con la versión actual",
    );
    assert.equal((await db.syncOutbox.get(op.id))!.state, "synced");
    assert.equal((await db.expenses.get("e-1"))!.syncStatus, "synced");
  });
});

// ---- ETAPA 6: pruebas de integridad del sync -------------------------------

describe("integridad: edición + alta durante el push (TEST 1)", () => {
  beforeEach(async () => {
    await Promise.all([db.syncOutbox.clear(), db.syncLog.clear(), db.syncState.clear(), db.expenses.clear()]);
  });

  it("pushes A, leaves B pending once A finishes, then pushes B on the next cycle", async () => {
    const server = new FakeServer();
    const { engine } = buildEngine(server);

    await addExpense("e-a");
    const opA = await seedExpense("e-a");

    server.duringPush = async () => {
      // Editar A mientras vuela (los servicios solo marcan syncStatus).
      await db.expenses.update("e-a", {
        amount: 500,
        updatedAt: "2026-01-01T00:30:00.000Z",
        syncStatus: "pending",
      });
      // Crear B durante el mismo vuelo.
      await addExpense("e-b");
    };

    await engine.runSync();

    // A termina con la versión editada (la edición no se pierde).
    assert.equal((await db.syncOutbox.get(opA.id))!.state, "synced");
    assert.equal((server.rows.get("e-a") as { amount: number }).amount, 500);
    assert.equal((await db.expenses.get("e-a"))!.syncStatus, "synced");

    // B = pending tras terminar A: el reconcile de este ciclo ya había corrido.
    assert.equal((await db.expenses.get("e-b"))!.syncStatus, "pending");
    const opsB = await db.syncOutbox.where("entityId").equals("e-b").toArray();
    assert.equal(opsB.length, 0, "B todavía no tiene operación encolada");
    assert.equal(server.rows.has("e-b"), false, "B no se envió en el ciclo de A");

    // B → PUSH en el siguiente ciclo.
    await engine.runSync();
    assert.equal(server.rows.has("e-b"), true, "B llega al servidor en el siguiente ciclo");
    assert.equal((await db.expenses.get("e-b"))!.syncStatus, "synced");
    assert.equal(server.pushCalls, 3, "A, la edición de A y B");
  });
});

describe("integridad: 429 rate limit (TEST 3)", () => {
  beforeEach(async () => {
    await Promise.all([db.syncOutbox.clear(), db.syncLog.clear(), db.syncState.clear(), db.expenses.clear()]);
  });

  it("leaves the operation failed with a future retryAt and no server row", async () => {
    const server = new FakeServer();
    server.queue.push(classifySyncError({ status: 429, message: "Too Many Requests" }));
    const { engine } = buildEngine(server);

    await addExpense("e-1");
    await seedExpense("e-1");
    await engine.runSync();

    const op = (await db.syncOutbox.where("entityId").equals("e-1").first())!;
    assert.equal(op.state, "failed");
    assert.equal(op.lastErrorType, "server");
    assert.equal(op.attempts, 1);
    assert.ok(op.retryAt, "retryAt != null");
    assert.ok(new Date(op.retryAt!).getTime() > Date.now(), "el reintento queda programado a futuro");
    assert.equal((await db.expenses.get("e-1"))!.syncStatus, "failed");
    assert.equal(server.rows.size, 0, "el 429 no confirma la escritura");
  });
});

describe("integridad: PGRST204 sin reintento infinito (TEST 4)", () => {
  beforeEach(async () => {
    await Promise.all([db.syncOutbox.clear(), db.syncLog.clear(), db.syncState.clear(), db.expenses.clear()]);
  });

  it("fails permanently and never retries on its own", async () => {
    const server = new FakeServer();
    server.queue.push(
      classifySyncError({
        status: 400,
        code: "PGRST204",
        message: "Could not find the 'category_id' column of 'expenses' in the schema cache",
      }),
    );
    const { engine } = buildEngine(server);

    await addExpense("e-1");
    await seedExpense("e-1");
    await engine.runSync();

    const op = (await db.syncOutbox.where("entityId").equals("e-1").first())!;
    assert.equal(op.state, "failed", "error de esquema");
    assert.equal(op.lastErrorType, "validation");
    assert.equal(op.retryAt, null, "sin reintento programado");
    assert.equal(op.attempts, 1);
    assert.equal(server.rows.size, 0, "la escritura no se confirma");

    // Ningún ciclo posterior reintenta por su cuenta (sin retries infinitos).
    await engine.runSync();
    await engine.runSync();
    const after = (await db.syncOutbox.get(op.id))!;
    assert.equal(server.pushCalls, 1, "no se vuelve a enviar");
    assert.equal(after.state, "failed");
    assert.equal(after.attempts, 1, "los intentos no crecen sin intervención");
    assert.equal(after.retryAt, null);
  });
});

describe("integridad: 409 separado en conflicto real y transitorio (TEST 5)", () => {
  beforeEach(async () => {
    await Promise.all([db.syncOutbox.clear(), db.syncLog.clear(), db.syncState.clear(), db.expenses.clear()]);
  });

  it("real conflict (divergent versions) lands in conflict and is not retried automatically", async () => {
    const server = new FakeServer();
    server.queue.push(classifySyncError({ status: 409, message: "conflicting row version" }));
    const { engine } = buildEngine(server);

    await addExpense("e-1");
    await seedExpense("e-1");
    await engine.runSync();

    const op = (await db.syncOutbox.where("entityId").equals("e-1").first())!;
    assert.equal(op.state, "conflict");
    assert.equal(op.lastErrorType, "conflict");
    assert.equal(op.retryAt, null);
    assert.equal(engine.getSnapshot().conflictCount, 1);
    assert.equal((await db.expenses.get("e-1"))!.syncStatus, "conflict");

    await engine.runSync();
    assert.equal(server.pushCalls, 1, "un conflicto real no se reintenta solo");
    assert.equal((await db.syncOutbox.get(op.id))!.state, "conflict");
  });

  it("transient 409 (serialization collision) is failed with retryAt, not conflict", async () => {
    const server = new FakeServer();
    server.queue.push(
      classifySyncError({ status: 409, message: "could not serialize access due to concurrent update" }),
    );
    const { engine } = buildEngine(server);

    await addExpense("e-1");
    await seedExpense("e-1");
    await engine.runSync();

    const op = (await db.syncOutbox.where("entityId").equals("e-1").first())!;
    assert.equal(op.state, "failed");
    assert.equal(op.lastErrorType, "server");
    assert.ok(op.retryAt, "el choque transitorio sí se reintenta");
    assert.equal(engine.getSnapshot().conflictCount, 0, "no se convierte en conflicto");
    assert.equal((await db.expenses.get("e-1"))!.syncStatus, "failed");
  });
});

describe("integridad: aislamiento de workspaces en el push (TEST 6)", () => {
  beforeEach(async () => {
    await Promise.all([db.syncOutbox.clear(), db.syncLog.clear(), db.syncState.clear(), db.expenses.clear()]);
  });

  it("never crosses rows between workspace A and workspace B", async () => {
    const server = new FakeServer();
    const { engine } = buildEngine(server);

    const rowA = makeExpense("e-a", { workspaceId: "ws-a" });
    const rowB = makeExpense("e-b", { workspaceId: "ws-b" });
    await db.expenses.add(rowA as unknown as Expense);
    await db.expenses.add(rowB as unknown as Expense);
    const opA = await enqueueOperation({
      entity: "expenses",
      entityId: "e-a",
      workspaceId: "ws-a",
      op: "upsert",
      payload: rowA,
      now: T0,
    });
    const opB = await enqueueOperation({
      entity: "expenses",
      entityId: "e-b",
      workspaceId: "ws-b",
      op: "upsert",
      payload: rowB,
      now: T0,
    });

    await engine.runSync();

    // El outbox conserva el workspace de cada operación y de cada payload.
    const afterA = (await db.syncOutbox.get(opA.id))!;
    const afterB = (await db.syncOutbox.get(opB.id))!;
    assert.equal(afterA.workspaceId, "ws-a");
    assert.equal(afterB.workspaceId, "ws-b");
    assert.equal((afterA.payload as { workspaceId: string }).workspaceId, "ws-a");
    assert.equal((afterB.payload as { workspaceId: string }).workspaceId, "ws-b");

    // El servidor recibe cada fila con su propio workspace.
    const serverA = server.rows.get("e-a") as { workspaceId: string };
    const serverB = server.rows.get("e-b") as { workspaceId: string };
    assert.equal(serverA.workspaceId, "ws-a");
    assert.equal(serverB.workspaceId, "ws-b");
    assert.notEqual(serverA.workspaceId, serverB.workspaceId, "A → B / B → A está prohibido");

    // El pull no reescribe el workspace de ninguna fila local.
    assert.equal((await db.expenses.get("e-a"))!.workspaceId, "ws-a");
    assert.equal((await db.expenses.get("e-b"))!.workspaceId, "ws-b");
    assert.equal(afterA.state, "synced");
    assert.equal(afterB.state, "synced");
  });
});

