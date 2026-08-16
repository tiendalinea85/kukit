import "fake-indexeddb/auto";
import { describe, beforeEach, it } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db.ts";
import {
  canonicalStringify,
  claimNextBatch,
  completeOperation,
  countOutbox,
  enqueueOperation,
  failOperation,
  hashPayload,
  recoverStaleOps,
  reconcilePendingEntities,
  requeueOperation,
} from "./outbox.ts";
import type { OutboxOperation } from "../../types/sync.ts";

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

async function seedOutbox(entityId: string, payload: Record<string, unknown>, now = T0): Promise<OutboxOperation> {
  return enqueueOperation({ entity: "expenses", entityId, op: "upsert", payload, now });
}

describe("canonicalStringify / hashPayload", () => {
  it("es estable sin importar el orden de las claves", () => {
    const a = { b: 1, a: "x", c: { z: true, y: [1, 2] } };
    const b = { c: { y: [1, 2], z: true }, a: "x", b: 1 };
    assert.equal(canonicalStringify(a), canonicalStringify(b));
    assert.equal(hashPayload(a), hashPayload(b));
  });
});

describe("enqueueOperation", () => {
  beforeEach(async () => {
    await Promise.all([db.syncOutbox.clear(), db.syncLog.clear(), db.expenses.clear()]);
  });

  it("crea una operación pendiente", async () => {
    const op = await seedOutbox("e-1", makeExpense("e-1"));
    assert.equal(op.state, "pending");
    assert.equal(op.attempts, 0);
    assert.equal(op.entity, "expenses");
    assert.equal(await db.syncOutbox.count(), 1);
  });

  it("deduplica por (entity, entityId): nunca crea duplicados", async () => {
    await seedOutbox("e-1", makeExpense("e-1", { amount: 10 }));
    await seedOutbox("e-1", makeExpense("e-1", { amount: 25 }), "2026-01-01T01:00:00.000Z");
    const ops = await db.syncOutbox.toArray();
    assert.equal(ops.length, 1);
    assert.equal((ops[0].payload as { amount: number }).amount, 25);
  });

  it("si está en syncing actualiza el payload y conserva syncing", async () => {
    await seedOutbox("e-1", makeExpense("e-1"));
    const claimed = await claimNextBatch(10, T0);
    assert.equal(claimed[0].state, "syncing");
    await seedOutbox("e-1", makeExpense("e-1", { amount: 99 }), "2026-01-01T02:00:00.000Z");
    const op = (await db.syncOutbox.get(claimed[0].id))!;
    assert.equal(op.state, "syncing");
    assert.equal((op.payload as { amount: number }).amount, 99);
  });
});

describe("claimNextBatch / completeOperation", () => {
  beforeEach(async () => {
    await Promise.all([db.syncOutbox.clear(), db.syncLog.clear(), db.expenses.clear()]);
  });

  it("reclama solo las operaciones listas y las marca syncing", async () => {
    await seedOutbox("e-1", makeExpense("e-1"));
    const op2 = await seedOutbox("e-2", makeExpense("e-2"));
    await db.syncOutbox.update(op2.id, { retryAt: "2099-01-01T00:00:00.000Z" });
    const claimed = await claimNextBatch(10, T0);
    assert.equal(claimed.length, 1);
    assert.equal(claimed[0].entityId, "e-1");
    const op = (await db.syncOutbox.get(claimed[0].id))!;
    assert.equal(op.state, "syncing");
  });

  it("completeOperation marca synced y actualiza el syncStatus del registro", async () => {
    await db.expenses.add(makeExpense("e-1") as never);
    const op = await seedOutbox("e-1", makeExpense("e-1"));
    const claimed = await claimNextBatch(10, T0);
    const applied = await completeOperation(claimed[0], T0);
    assert.equal(applied, true);
    assert.equal((await db.syncOutbox.get(op.id))!.state, "synced");
    assert.equal((await db.expenses.get("e-1"))!.syncStatus, "synced");
  });

  it("si el payload cambió en vuelo, re-encola como pending (no pierde escrituras)", async () => {
    const op = await seedOutbox("e-1", makeExpense("e-1"));
    const claimed = await claimNextBatch(10, T0);
    await seedOutbox("e-1", makeExpense("e-1", { amount: 500 }), "2026-01-01T00:30:00.000Z");
    const applied = await completeOperation(claimed[0], "2026-01-01T00:40:00.000Z");
    assert.equal(applied, false);
    const after = (await db.syncOutbox.get(op.id))!;
    assert.equal(after.state, "pending");
    assert.equal((after.payload as { amount: number }).amount, 500);
  });
});

describe("failOperation (backoff)", () => {
  beforeEach(async () => {
    await Promise.all([db.syncOutbox.clear(), db.syncLog.clear(), db.expenses.clear()]);
  });

  it("error retryable → failed con retryAt futuro", async () => {
    await db.expenses.add(makeExpense("e-1") as never);
    const op = await seedOutbox("e-1", makeExpense("e-1"));
    await failOperation(op, {
      error: { type: "server", message: "error 500", retryable: true },
      now: T0,
    });
    const after = (await db.syncOutbox.get(op.id))!;
    assert.equal(after.state, "failed");
    assert.equal(after.attempts, 1);
    assert.ok(after.retryAt && new Date(after.retryAt).getTime() > new Date(T0).getTime());
    assert.equal((await db.expenses.get("e-1"))!.syncStatus, "failed");
  });

  it("error no retryable → failed sin reintento programado", async () => {
    const op = await seedOutbox("e-1", makeExpense("e-1"));
    await failOperation(op, {
      error: { type: "validation", message: "rechazado", retryable: false },
      now: T0,
    });
    const after = (await db.syncOutbox.get(op.id))!;
    assert.equal(after.state, "failed");
    assert.equal(after.retryAt, null);
    assert.equal(after.lastErrorType, "validation");
  });

  it("cada fallo incrementa attempts (backoff creciente)", async () => {
    const op = await seedOutbox("e-1", makeExpense("e-1"));
    await failOperation(op, { error: { type: "server", message: "x", retryable: true }, now: T0 });
    const op2 = (await db.syncOutbox.get(op.id))!;
    await failOperation(op2, { error: { type: "server", message: "x", retryable: true }, now: T0 });
    const after = (await db.syncOutbox.get(op.id))!;
    assert.equal(after.attempts, 2);
  });
});

describe("recoverStaleOps (app cerrada durante el sync)", () => {
  beforeEach(async () => {
    await Promise.all([db.syncOutbox.clear(), db.syncLog.clear(), db.expenses.clear()]);
  });

  it("recupera operaciones syncing estancadas hace más de `staleAfterMs`", async () => {
    const op = await seedOutbox("e-1", makeExpense("e-1"));
    await db.syncOutbox.update(op.id, {
      state: "syncing",
      lastAttemptAt: "2026-01-01T00:00:00.000Z",
    });
    const recovered = await recoverStaleOps({ now: "2026-01-01T01:00:00.000Z", staleAfterMs: 60_000 });
    assert.equal(recovered, 1);
    assert.equal((await db.syncOutbox.get(op.id))!.state, "pending");
  });

  it("no toca operaciones syncing recientes", async () => {
    const op = await seedOutbox("e-1", makeExpense("e-1"));
    await db.syncOutbox.update(op.id, { state: "syncing", lastAttemptAt: T0 });
    const recovered = await recoverStaleOps({ now: "2026-01-01T00:01:00.000Z", staleAfterMs: 5 * 60_000 });
    assert.equal(recovered, 0);
    assert.equal((await db.syncOutbox.get(op.id))!.state, "syncing");
  });

  it("recupera operaciones failed con retryAt vencido", async () => {
    const op = await seedOutbox("e-1", makeExpense("e-1"));
    await db.syncOutbox.update(op.id, {
      state: "failed",
      attempts: 2,
      retryAt: "2026-01-01T00:00:30.000Z",
    });
    const recovered = await recoverStaleOps({ now: "2026-01-01T00:01:00.000Z" });
    assert.equal(recovered, 1);
    assert.equal((await db.syncOutbox.get(op.id))!.state, "pending");
  });
});

describe("requeueOperation / reconcilePendingEntities", () => {
  beforeEach(async () => {
    await Promise.all([db.syncOutbox.clear(), db.syncLog.clear(), db.expenses.clear(), db.categories.clear()]);
  });

  it("requeueOperation resetea failed a pending", async () => {
    const op = await seedOutbox("e-1", makeExpense("e-1"));
    await failOperation(op, { error: { type: "validation", message: "x", retryable: false }, now: T0 });
    await requeueOperation(op.id, "2026-01-01T00:10:00.000Z");
    const after = (await db.syncOutbox.get(op.id))!;
    assert.equal(after.state, "pending");
    assert.equal(after.attempts, 0);
    assert.equal(after.retryAt, null);
  });

  it("reconcilia registros pending sin operación en el outbox", async () => {
    await db.expenses.add(makeExpense("e-1") as never);
    await db.categories.add({ id: "c-1", name: "Cat", color: "#000", icon: "x", createdAt: T0, syncStatus: "pending" } as never);
    const enqueued = await reconcilePendingEntities(T0);
    assert.equal(enqueued, 2);
    assert.equal(await db.syncOutbox.count(), 2);
  });

  it("no re-encola si la operación ya existe", async () => {
    await db.expenses.add(makeExpense("e-1") as never);
    await seedOutbox("e-1", makeExpense("e-1"));
    const enqueued = await reconcilePendingEntities(T0);
    assert.equal(enqueued, 0);
    assert.equal(await db.syncOutbox.count(), 1);
  });

  it("no reconcilia registros con syncStatus synced", async () => {
    await db.expenses.add(makeExpense("e-1", { syncStatus: "synced" }) as never);
    const enqueued = await reconcilePendingEntities(T0);
    assert.equal(enqueued, 0);
    assert.equal(await db.syncOutbox.count(), 0);
  });
});

describe("countOutbox", () => {
  beforeEach(async () => {
    await Promise.all([db.syncOutbox.clear(), db.syncLog.clear(), db.expenses.clear()]);
  });

  it("cuenta por estado", async () => {
    const op = await seedOutbox("e-1", makeExpense("e-1"));
    await seedOutbox("e-2", makeExpense("e-2"));
    await db.syncOutbox.update(op.id, { state: "failed" });
    const counts = await countOutbox();
    assert.equal(counts.pending, 1);
    assert.equal(counts.failed, 1);
    assert.equal(counts.syncing, 0);
    assert.equal(counts.conflict, 0);
  });
});
