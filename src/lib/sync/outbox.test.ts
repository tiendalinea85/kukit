import "fake-indexeddb/auto";
import { describe, beforeEach, after, it } from "node:test";
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
  trimSyncLog,
  SYNC_LOG_MAX_ENTRIES,
  SYNC_LOG_MAX_AGE_MS,
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

  it("two concurrent enqueues of the same entity leave a single operation (TEST 2)", async () => {
    const [a, b] = await Promise.all([
      enqueueOperation({ entity: "expenses", entityId: "e-1", op: "upsert", payload: makeExpense("e-1", { amount: 10 }), now: T0 }),
      enqueueOperation({ entity: "expenses", entityId: "e-1", op: "upsert", payload: makeExpense("e-1", { amount: 20 }), now: T0 }),
    ]);

    assert.equal(a.id, b.id, "ambas llamadas apuntan a la misma operación");
    assert.equal(await db.syncOutbox.count(), 1, "una sola operación en el outbox");
    const op = (await db.syncOutbox.get(a.id))!;
    assert.equal(op.state, "pending");
    assert.equal(op.payloadHash, hashPayload(op.payload), "el hash describe el payload final");
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

describe("reconcilePendingEntities: dependencias por clave foránea", () => {
  beforeEach(async () => {
    await Promise.all([
      db.syncOutbox.clear(),
      db.syncLog.clear(),
      db.expenses.clear(),
      db.expenseDetails.clear(),
      db.categories.clear(),
      db.products.clear(),
    ]);
  });

  after(async () => {
    await Promise.all([
      db.syncOutbox.clear(),
      db.expenses.clear(),
      db.expenseDetails.clear(),
      db.categories.clear(),
      db.products.clear(),
    ]);
  });

  function makeCategory(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return { id, name: `Cat ${id}`, color: "#000", icon: "x", createdAt: T0, syncStatus: "local", ...overrides };
  }

  function makeProduct(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return { id, code: `P-${id}`, name: `Prod ${id}`, createdAt: T0, syncStatus: "local", ...overrides };
  }

  it("encola la categoría local referenciada por un gasto pendiente", async () => {
    await db.categories.add(makeCategory("cat-1") as never);
    await db.expenses.add(makeExpense("e-1") as never);

    await reconcilePendingEntities(T0);

    const ops = await db.syncOutbox.toArray();
    assert.deepEqual(ops.map((o) => o.entity).sort(), ["categories", "expenses"]);
    assert.equal(ops.find((o) => o.entity === "categories")!.entityId, "cat-1");
  });

  it("encola el producto local referenciado por un detalle pendiente", async () => {
    await db.products.add(makeProduct("prod-1") as never);
    await db.expenseDetails.add({
      id: "d-1",
      expenseId: "e-1",
      productId: "prod-1",
      createdAt: T0,
      deleted: false,
      syncStatus: "pending",
    } as never);

    await reconcilePendingEntities(T0);

    assert.deepEqual(
      (await db.syncOutbox.toArray()).map((o) => o.entity).sort(),
      ["expenseDetails", "products"],
    );
  });

  it("no encola una dependencia ya synced", async () => {
    await db.categories.add(makeCategory("cat-1", { syncStatus: "synced" }) as never);
    await db.expenses.add(makeExpense("e-1") as never);

    await reconcilePendingEntities(T0);

    assert.deepEqual((await db.syncOutbox.toArray()).map((o) => o.entity), ["expenses"]);
  });

  it("no encola una dependencia borrada (tombstone)", async () => {
    await db.categories.add(makeCategory("cat-1", { deleted: true }) as never);
    await db.expenses.add(makeExpense("e-1") as never);

    await reconcilePendingEntities(T0);

    assert.deepEqual((await db.syncOutbox.toArray()).map((o) => o.entity), ["expenses"]);
  });

  it("no duplica la operación si la dependencia ya está encolada", async () => {
    await db.categories.add(makeCategory("cat-1") as never);
    await db.expenses.add(makeExpense("e-1") as never);
    await enqueueOperation({
      entity: "categories",
      entityId: "cat-1",
      op: "upsert",
      payload: makeCategory("cat-1"),
      now: T0,
    });

    await reconcilePendingEntities(T0);

    const catOps = (await db.syncOutbox.toArray()).filter((o) => o.entity === "categories");
    assert.equal(catOps.length, 1);
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

describe("hash: detector de cambios (payload A vs A reordenado vs B)", () => {
  it("A == A reordenado y A != B", () => {
    const a = { id: "e-1", amount: 10, nested: { x: 1, y: [1, 2] } };
    const aReordered = { nested: { y: [1, 2], x: 1 }, amount: 10, id: "e-1" };
    const b = { id: "e-1", amount: 11, nested: { x: 1, y: [1, 2] } };

    assert.equal(hashPayload(a), hashPayload(aReordered), "el orden de claves no cambia el hash");
    assert.notEqual(hashPayload(a), hashPayload(b), "un payload distinto produce otro hash");
  });
});

describe("reconcilePendingEntities: payload fresco (O1)", () => {
  beforeEach(async () => {
    await Promise.all([db.syncOutbox.clear(), db.syncLog.clear(), db.expenses.clear(), db.categories.clear()]);
  });

  it("refresca el payload cuando la fila cambió después de encolar", async () => {
    await db.expenses.add(makeExpense("e-1") as never);
    await seedOutbox("e-1", makeExpense("e-1")); // payload v1

    // Edición posterior: los servicios solo marcan syncStatus, no encolan.
    await db.expenses.update("e-1", {
      amount: 500,
      updatedAt: "2026-01-01T02:00:00.000Z",
      syncStatus: "pending",
    });

    const enqueued = await reconcilePendingEntities("2026-01-01T03:00:00.000Z");

    assert.equal(enqueued, 0, "no crea una operación nueva");
    assert.equal(await db.syncOutbox.count(), 1, "no duplica la operación");
    const op = (await db.syncOutbox.toArray())[0];
    assert.equal(op.state, "pending");
    assert.equal((op.payload as { amount: number }).amount, 500, "payload actualizado al de la fila");
  });

  it("reactiva una operación ya synced cuando la fila vuelve a quedar pending", async () => {
    await db.expenses.add(makeExpense("e-1") as never);
    await seedOutbox("e-1", makeExpense("e-1"));
    const first = await claimNextBatch(10, T0);
    assert.equal(await completeOperation(first[0], T0), true);
    assert.equal((await db.syncOutbox.toArray())[0].state, "synced");
    assert.equal((await db.expenses.get("e-1"))!.syncStatus, "synced");

    // Segunda edición del mismo registro.
    await db.expenses.update("e-1", {
      amount: 500,
      updatedAt: "2026-01-01T02:00:00.000Z",
      syncStatus: "pending",
    });
    await reconcilePendingEntities("2026-01-01T03:00:00.000Z");

    const op = (await db.syncOutbox.toArray())[0];
    assert.equal(op.state, "pending", "vuelve a la cola");
    assert.equal((op.payload as { amount: number }).amount, 500, "con la versión actual");

    const again = await claimNextBatch(10, "2026-01-01T04:00:00.000Z");
    assert.equal(again.length, 1, "se puede reclamar de nuevo");
  });

  it("no toca una operación viva cuyo payload ya describe la fila", async () => {
    await db.expenses.add(makeExpense("e-1") as never);
    await seedOutbox("e-1", makeExpense("e-1"));
    const enqueued = await reconcilePendingEntities(T0);
    assert.equal(enqueued, 0);
    assert.equal((await db.syncOutbox.toArray())[0].state, "pending");
  });

  it("refresca el contenido de una operación fallida sin resetear su backoff", async () => {
    await db.expenses.add(makeExpense("e-1") as never);
    const op = await seedOutbox("e-1", makeExpense("e-1"));
    await failOperation(op, {
      error: { type: "network", message: "offline", retryable: true },
      now: T0,
    });

    await db.expenses.update("e-1", {
      amount: 500,
      updatedAt: "2026-01-01T02:00:00.000Z",
      syncStatus: "pending",
    });
    const enqueued = await reconcilePendingEntities("2026-01-01T03:00:00.000Z");

    assert.equal(enqueued, 0);
    const after = (await db.syncOutbox.get(op.id))!;
    assert.equal(after.state, "failed", "sigue fallida");
    assert.equal(after.attempts, 1, "el backoff no se resetea");
    assert.ok(after.retryAt, "conserva el reintento programado");
    assert.equal((after.payload as { amount: number }).amount, 500, "pero con el contenido actual");
  });

  it("no reabre un conflicto pendiente de decisión", async () => {
    await db.expenses.add(makeExpense("e-1") as never);
    const op = await seedOutbox("e-1", makeExpense("e-1"));
    await db.syncOutbox.update(op.id, { state: "conflict" });
    // El usuario edita el registro en conflicto: el servicio lo marca pending.
    await db.expenses.update("e-1", {
      amount: 500,
      updatedAt: "2026-01-01T02:00:00.000Z",
      syncStatus: "pending",
    });

    await reconcilePendingEntities("2026-01-01T03:00:00.000Z");

    const after = (await db.syncOutbox.get(op.id))!;
    assert.equal(after.state, "conflict", "el conflicto requiere decisión del usuario");
    assert.equal((after.payload as { amount: number }).amount, 500, "pero no se queda con el payload viejo");
  });
});

describe("completeOperation: compare-and-set contra la fila local (O9)", () => {
  beforeEach(async () => {
    await Promise.all([db.syncOutbox.clear(), db.syncLog.clear(), db.expenses.clear()]);
  });

  it("PUSH A → edición B → A termina: B permanece pendiente", async () => {
    await db.expenses.add(makeExpense("e-1") as never);
    const op = await seedOutbox("e-1", makeExpense("e-1"));
    const claimed = await claimNextBatch(10, T0);
    assert.equal(claimed[0].state, "syncing");

    // Edición B hecha DURANTE el push, sin pasar por enqueueOperation.
    await db.expenses.update("e-1", {
      amount: 500,
      updatedAt: "2026-01-01T00:30:00.000Z",
      syncStatus: "pending",
    });

    const applied = await completeOperation(claimed[0], "2026-01-01T00:40:00.000Z");

    assert.equal(applied, false, "A no puede marcar como synced una fila más nueva");
    const after = (await db.syncOutbox.get(op.id))!;
    assert.equal(after.state, "pending", "B sigue en la cola");
    assert.equal((after.payload as { amount: number }).amount, 500, "payload refrescado desde la fila");
    assert.equal(after.claimedRowHash, null);
    assert.equal((await db.expenses.get("e-1"))!.syncStatus, "pending", "el registro no se marca synced");

    const next = await claimNextBatch(10, "2026-01-01T00:50:00.000Z");
    assert.equal(next.length, 1, "B se reclama en la siguiente pasada");
    assert.equal((next[0].payload as { amount: number }).amount, 500);
  });

  it("detecta el cambio aunque la fila no tenga updatedAt", async () => {
    // `categories` no tiene `updatedAt`: el detector no puede apoyarse en el
    // tiempo, por eso se compara la huella de la fila completa.
    await db.categories.add({
      id: "c-1",
      workspaceId: "default",
      name: "Antes",
      color: "#000",
      icon: "x",
      createdAt: T0,
      syncStatus: "pending",
    } as never);
    await enqueueOperation({
      entity: "categories",
      entityId: "c-1",
      workspaceId: "default",
      op: "upsert",
      payload: { id: "c-1", name: "Antes", createdAt: T0, syncStatus: "pending" },
      now: T0,
    });

    const claimed = await claimNextBatch(10, T0);
    await db.categories.update("c-1", { name: "Después", syncStatus: "pending" });

    const applied = await completeOperation(claimed[0], "2026-01-01T00:40:00.000Z");

    assert.equal(applied, false);
    const op = (await db.syncOutbox.toArray())[0];
    assert.equal(op.state, "pending");
    assert.equal((op.payload as { name: string }).name, "Después");
    assert.equal((await db.categories.get("c-1"))!.syncStatus, "pending");
  });
});

describe("claimNextBatch: reclamo exclusivo (O7)", () => {
  beforeEach(async () => {
    await Promise.all([db.syncOutbox.clear(), db.syncLog.clear(), db.expenses.clear()]);
  });

  it("dos reclamaciones concurrentes no reclaman la misma operación", async () => {
    await seedOutbox("e-1", makeExpense("e-1"));
    await seedOutbox("e-2", makeExpense("e-2"));

    const [a, b] = await Promise.all([claimNextBatch(10, T0), claimNextBatch(10, T0)]);

    const ids = [...a, ...b].map((op) => op.id);
    assert.equal(ids.length, 2, "cada operación se reclama una sola vez");
    assert.equal(new Set(ids).size, 2, "sin doble procesamiento");
    const syncing = (await db.syncOutbox.toArray()).filter((op) => op.state === "syncing");
    assert.equal(syncing.length, 2);
  });
});

describe("recoverStaleOps: recuperación selectiva (TEST 7)", () => {
  beforeEach(async () => {
    await Promise.all([db.syncOutbox.clear(), db.syncLog.clear(), db.expenses.clear()]);
  });

  it("recovers only the stale syncing op and leaves every other op untouched", async () => {
    const now = "2026-01-01T00:10:00.000Z";

    const stale = await seedOutbox("e-stale", makeExpense("e-stale"));
    const fresh = await seedOutbox("e-fresh", makeExpense("e-fresh"));
    const failedFuture = await seedOutbox("e-failed", makeExpense("e-failed"));
    const conflict = await seedOutbox("e-conflict", makeExpense("e-conflict"));
    const synced = await seedOutbox("e-synced", makeExpense("e-synced"));

    await db.syncOutbox.update(stale.id, {
      state: "syncing",
      lastAttemptAt: "2020-01-01T00:00:00.000Z",
      updatedAt: "2020-01-01T00:00:00.000Z",
    });
    await db.syncOutbox.update(fresh.id, {
      state: "syncing",
      lastAttemptAt: "2026-01-01T00:09:00.000Z",
      updatedAt: "2026-01-01T00:09:00.000Z",
    });
    await db.syncOutbox.update(failedFuture.id, {
      state: "failed",
      attempts: 2,
      lastError: "boom",
      lastErrorType: "server",
      retryAt: "2026-01-01T01:00:00.000Z",
      updatedAt: "2026-01-01T00:01:00.000Z",
    });
    await db.syncOutbox.update(conflict.id, {
      state: "conflict",
      attempts: 1,
      lastError: "versión remota más nueva",
      lastErrorType: "conflict",
      retryAt: null,
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    await db.syncOutbox.update(synced.id, { state: "synced", updatedAt: "2026-01-01T00:03:00.000Z" });

    const recovered = await recoverStaleOps({ now });

    assert.equal(recovered, 1, "solo el syncing estancado se recupera");
    assert.equal((await db.syncOutbox.get(stale.id))!.state, "pending");

    const freshAfter = (await db.syncOutbox.get(fresh.id))!;
    assert.equal(freshAfter.state, "syncing", "syncing reciente no se recupera");
    assert.equal(freshAfter.updatedAt, "2026-01-01T00:09:00.000Z", "sin cambios");

    const failedAfter = (await db.syncOutbox.get(failedFuture.id))!;
    assert.equal(failedAfter.state, "failed", "retry futuro no vuelve a pending");
    assert.equal(failedAfter.attempts, 2, "attempts intactos");
    assert.equal(failedAfter.retryAt, "2026-01-01T01:00:00.000Z", "backoff intacto");
    assert.equal(failedAfter.updatedAt, "2026-01-01T00:01:00.000Z", "sin cambios");

    const conflictAfter = (await db.syncOutbox.get(conflict.id))!;
    assert.equal(conflictAfter.state, "conflict", "un conflicto nunca se recupera solo");
    assert.equal(conflictAfter.lastError, "versión remota más nueva");
    assert.equal(conflictAfter.updatedAt, "2026-01-01T00:02:00.000Z", "sin cambios");

    assert.equal((await db.syncOutbox.get(synced.id))!.state, "synced", "synced no se toca");
  });
});

describe("requeueOperation: failed vs conflict (TEST 8)", () => {
  beforeEach(async () => {
    await Promise.all([db.syncOutbox.clear(), db.syncLog.clear(), db.expenses.clear()]);
  });

  it("auto-recovery treats them differently: expired failed retries recover, conflicts never do", async () => {
    const now = "2026-01-01T00:10:00.000Z";
    const failed = await seedOutbox("e-failed", makeExpense("e-failed"));
    const conflict = await seedOutbox("e-conflict", makeExpense("e-conflict"));
    await db.syncOutbox.update(failed.id, {
      state: "failed",
      attempts: 3,
      lastError: "error 500",
      lastErrorType: "server",
      retryAt: "2026-01-01T00:05:00.000Z",
    });
    await db.syncOutbox.update(conflict.id, {
      state: "conflict",
      attempts: 1,
      lastError: "versión remota más nueva",
      lastErrorType: "conflict",
      retryAt: null,
    });

    const recovered = await recoverStaleOps({ now });

    assert.equal(recovered, 1, "solo el failed con retry vencido");
    assert.equal((await db.syncOutbox.get(failed.id))!.state, "pending");
    assert.equal((await db.syncOutbox.get(conflict.id))!.state, "conflict", "el conflicto requiere decisión");
  });

  it("manual requeue clears both, but each record keeps its origin until push confirms", async () => {
    await db.expenses.add(makeExpense("e-failed", { syncStatus: "failed" }) as never);
    await db.expenses.add(makeExpense("e-conflict", { syncStatus: "conflict" }) as never);
    const failed = await seedOutbox("e-failed", makeExpense("e-failed", { syncStatus: "failed" }));
    const conflict = await seedOutbox("e-conflict", makeExpense("e-conflict", { syncStatus: "conflict" }));
    await db.syncOutbox.update(failed.id, {
      state: "failed",
      attempts: 3,
      lastError: "error 500",
      lastErrorType: "server",
      retryAt: "2026-01-01T01:00:00.000Z",
    });
    await db.syncOutbox.update(conflict.id, {
      state: "conflict",
      attempts: 1,
      lastError: "versión remota más nueva",
      lastErrorType: "conflict",
      retryAt: null,
    });

    await requeueOperation(failed.id, T0);
    await requeueOperation(conflict.id, T0);

    for (const id of [failed.id, conflict.id]) {
      const op = (await db.syncOutbox.get(id))!;
      assert.equal(op.state, "pending");
      assert.equal(op.attempts, 0, "attempts reseteados");
      assert.equal(op.lastError, null);
      assert.equal(op.retryAt, null);
    }

    // La diferencia real: el registro conserva el origen de cada una hasta que
    // el push confirme (failed sigue fallada, conflict sigue en conflicto).
    assert.equal((await db.expenses.get("e-failed"))!.syncStatus, "failed");
    assert.equal((await db.expenses.get("e-conflict"))!.syncStatus, "conflict");

    const claimed = await claimNextBatch(10, T0);
    assert.equal(claimed.length, 2, "ambas quedan reclamables para el siguiente push");
  });
});

describe("trimSyncLog: poda del log de sincronización", () => {
  beforeEach(async () => {
    await db.syncLog.clear();
  });

  it("keeps at most SYNC_LOG_MAX_ENTRIES entries, dropping the oldest", async () => {
    const base = new Date(T0).getTime();
    const total = SYNC_LOG_MAX_ENTRIES + 50;
    const rows = Array.from({ length: total }, (_, i) => ({
      id: `log-${String(i).padStart(5, "0")}`,
      ts: new Date(base + i * 1000).toISOString(),
      level: "info" as const,
      event: "sync_started" as const,
      message: `evento ${i}`,
    }));
    await db.syncLog.bulkAdd(rows);

    const removed = await trimSyncLog(new Date(base + total * 1000).toISOString());

    assert.equal(removed, 50);
    assert.equal(await db.syncLog.count(), SYNC_LOG_MAX_ENTRIES);
    const remaining = await db.syncLog.orderBy("ts").toArray();
    assert.equal(remaining[0].id, "log-00050", "las entradas más antiguas se podan");
    assert.equal(remaining[remaining.length - 1].id, `log-${String(total - 1).padStart(5, "0")}`);
  });

  it("deletes entries older than SYNC_LOG_MAX_AGE_MS", async () => {
    const now = "2026-03-01T00:00:00.000Z";
    assert.ok(new Date(now).getTime() - new Date("2026-01-01T00:00:00.000Z").getTime() > SYNC_LOG_MAX_AGE_MS);
    await db.syncLog.bulkAdd([
      { id: "vieja", ts: "2026-01-01T00:00:00.000Z", level: "info", event: "sync_started", message: "vieja" },
      { id: "reciente", ts: "2026-02-28T00:00:00.000Z", level: "info", event: "sync_started", message: "reciente" },
    ]);

    const removed = await trimSyncLog(now);

    assert.equal(removed, 1);
    const ids = (await db.syncLog.toArray()).map((entry) => entry.id);
    assert.deepEqual(ids, ["reciente"]);
  });

  it("does nothing when the log is within both limits", async () => {
    await db.syncLog.bulkAdd([
      { id: "a", ts: T0, level: "info", event: "sync_started" },
      { id: "b", ts: T0, level: "warn", event: "push_failed" },
    ]);

    const removed = await trimSyncLog("2026-01-02T00:00:00.000Z");

    assert.equal(removed, 0);
    assert.equal(await db.syncLog.count(), 2);
  });
});
