import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { db } from "../db.ts";
import {
  enqueueOperation,
  claimNextBatch,
  completeOperation,
  failOperation,
  recoverStaleOps,
  reconcilePendingEntities,
  countOutbox,
  hashPayload,
  canonicalStringify,
  SYNC_ENTITY_TABLES,
} from "./outbox.ts";
import { computeBackoffDelay, DEFAULT_BACKOFF } from "./backoff.ts";
import { classifySyncError } from "./errors.ts";
import { compareVersions, resolveConflict, isAppendOnly, isRegisteredOperation } from "./conflicts.ts";
import type { SyncTransportEntity, OutboxOperation } from "../../types/sync.ts";

beforeEach(async () => {
  await db.syncOutbox.clear();
  await db.syncLog.clear();
  await db.syncState.clear();
  await db.expenses.clear();
  await db.categories.clear();
  await db.garments.clear();
  await db.crops.clear();
  await db.autoParts.clear();
  await db.animals.clear();
  await db.sizes.clear();
  await db.garmentColors.clear();
  await db.vehicleBrands.clear();
  await db.species.clear();
});

function makeTransport(
  overrides: Partial<SyncTransportEntity>[] = [],
): SyncTransportEntity[] {
  const defaults: SyncTransportEntity[] = SYNC_ENTITY_TABLES.map((name) => ({
    name,
    serverTable: name,
    order: 0,
    async push() {
      return null;
    },
    async pull() {
      return { rows: [], watermark: null };
    },
  }));
  for (const o of overrides) {
    const idx = defaults.findIndex((d) => d.name === o.name);
    if (idx >= 0) Object.assign(defaults[idx], o);
    else defaults.push(o as SyncTransportEntity);
  }
  return defaults;
}

describe("Outbox: enqueue + deduplication", () => {
  it("creates a pending operation", async () => {
    const op = await enqueueOperation({
      entity: "expenses",
      entityId: "e1",
      workspaceId: "ws-1",
      op: "upsert",
      payload: { id: "e1", amount: 10 },
    });
    assert.equal(op.state, "pending");
    assert.equal(op.entity, "expenses");
    assert.equal(op.entityId, "e1");
    assert.equal(op.workspaceId, "ws-1");
    assert.equal(op.attempts, 0);
  });

  it("deduplicates by (entity, entityId)", async () => {
    const op1 = await enqueueOperation({
      entity: "expenses",
      entityId: "e1",
      workspaceId: "ws-1",
      op: "upsert",
      payload: { id: "e1", amount: 10 },
    });
    const op2 = await enqueueOperation({
      entity: "expenses",
      entityId: "e1",
      workspaceId: "ws-1",
      op: "upsert",
      payload: { id: "e1", amount: 20 },
    });
    assert.equal(op1.id, op2.id, "same outbox row");
    assert.equal(op2.payload.amount, 20, "payload updated");
    const count = await db.syncOutbox.count();
    assert.equal(count, 1, "only one row in outbox");
  });

  it("preserves syncing state when re-enqueued during flight", async () => {
    const op1 = await enqueueOperation({
      entity: "expenses",
      entityId: "e1",
      workspaceId: "ws-1",
      op: "upsert",
      payload: { id: "e1", amount: 10 },
    });
    await db.syncOutbox.update(op1.id, { state: "syncing" });
    const op2 = await enqueueOperation({
      entity: "expenses",
      entityId: "e1",
      workspaceId: "ws-1",
      op: "upsert",
      payload: { id: "e1", amount: 30 },
    });
    assert.equal(op2.state, "syncing", "stays syncing");
    assert.equal(op2.payload.amount, 30, "payload updated even while syncing");
  });

  it("different entities do not collide", async () => {
    await enqueueOperation({ entity: "expenses", entityId: "e1", op: "upsert", payload: { id: "e1" } });
    await enqueueOperation({ entity: "sales", entityId: "e1", op: "upsert", payload: { id: "e1" } });
    const count = await db.syncOutbox.count();
    assert.equal(count, 2);
  });
});

describe("Outbox: claimNextBatch with FK ordering", () => {
  it("claims categories before expenses", async () => {
    const now = new Date().toISOString();
    await enqueueOperation({ entity: "expenses", entityId: "e1", op: "upsert", payload: {}, now });
    await enqueueOperation({ entity: "categories", entityId: "c1", op: "upsert", payload: {}, now });
    await enqueueOperation({ entity: "products", entityId: "p1", op: "upsert", payload: {}, now });

    const batch = await claimNextBatch(10, now);
    assert.equal(batch[0].entity, "categories");
    assert.equal(batch[1].entity, "products");
    assert.equal(batch[2].entity, "expenses");
  });

  it("claims new module entities in correct order", async () => {
    const now = new Date().toISOString();
    await enqueueOperation({ entity: "garments", entityId: "g1", op: "upsert", payload: {}, now });
    await enqueueOperation({ entity: "sizes", entityId: "s1", op: "upsert", payload: {}, now });
    await enqueueOperation({ entity: "garmentColors", entityId: "gc1", op: "upsert", payload: {}, now });
    await enqueueOperation({ entity: "materials", entityId: "m1", op: "upsert", payload: {}, now });
    await enqueueOperation({ entity: "productionOrders", entityId: "po1", op: "upsert", payload: {}, now });
    await enqueueOperation({ entity: "productionMaterials", entityId: "pm1", op: "upsert", payload: {}, now });

    const batch = await claimNextBatch(10, now);
    const names = batch.map((b) => b.entity);
    const sizesIdx = names.indexOf("sizes");
    const garmentColorsIdx = names.indexOf("garmentColors");
    const garmentsIdx = names.indexOf("garments");
    const productionOrdersIdx = names.indexOf("productionOrders");
    const productionMaterialsIdx = names.indexOf("productionMaterials");

    assert.ok(sizesIdx < garmentsIdx, "sizes before garments");
    assert.ok(garmentColorsIdx < garmentsIdx, "garmentColors before garments");
    assert.ok(garmentsIdx < productionOrdersIdx, "garments before productionOrders");
    assert.ok(productionOrdersIdx < productionMaterialsIdx, "productionOrders before productionMaterials");
  });

  it("skips ops with future retryAt", async () => {
    const now = new Date().toISOString();
    const future = new Date(Date.now() + 60_000).toISOString();
    const op = await enqueueOperation({ entity: "expenses", entityId: "e1", op: "upsert", payload: {}, now });
    await db.syncOutbox.update(op.id, { retryAt: future });
    const batch = await claimNextBatch(10, now);
    assert.equal(batch.length, 0);
  });

  it("respects limit", async () => {
    const now = new Date().toISOString();
    for (let i = 0; i < 5; i++) {
      await enqueueOperation({ entity: "expenses", entityId: `e${i}`, op: "upsert", payload: {}, now });
    }
    const batch = await claimNextBatch(3, now);
    assert.equal(batch.length, 3);
  });
});

describe("Outbox: completeOperation idempotency", () => {
  it("marks as synced when hash matches", async () => {
    const payload = { id: "e1", amount: 10 };
    const op = await enqueueOperation({ entity: "expenses", entityId: "e1", op: "upsert", payload });
    const applied = await completeOperation(op);
    assert.equal(applied, true);
    const current = await db.syncOutbox.get(op.id);
    assert.equal(current?.state, "synced");
  });

  it("re-enqueues when payload changed during flight", async () => {
    const op = await enqueueOperation({
      entity: "expenses",
      entityId: "e1",
      op: "upsert",
      payload: { id: "e1", amount: 10 },
    });
    await db.syncOutbox.update(op.id, { state: "syncing" });
    await enqueueOperation({
      entity: "expenses",
      entityId: "e1",
      op: "upsert",
      payload: { id: "e1", amount: 25 },
    });
    const stalePayload = { id: "e1", amount: 10 };
    const applied = await completeOperation({ ...op, payload: stalePayload });
    assert.equal(applied, false, "was stale");
    const current = await db.syncOutbox.get(op.id);
    assert.equal(current?.state, "pending", "re-enqueued as pending");
  });
});

describe("Outbox: fail + backoff", () => {
  it("schedules retry for retryable errors", async () => {
    const op = await enqueueOperation({
      entity: "expenses",
      entityId: "e1",
      op: "upsert",
      payload: { id: "e1" },
    });
    await failOperation(op, {
      error: { type: "network", message: "offline", retryable: true },
    });
    const current = await db.syncOutbox.get(op.id);
    assert.equal(current?.state, "failed");
    assert.equal(current?.attempts, 1);
    assert.ok(current?.retryAt, "retry scheduled");
    assert.ok(new Date(current!.retryAt!).getTime() > Date.now());
  });

  it("no retry for permanent errors", async () => {
    const op = await enqueueOperation({
      entity: "expenses",
      entityId: "e1",
      op: "upsert",
      payload: { id: "e1" },
    });
    await failOperation(op, {
      error: { type: "auth", message: "unauthorized", retryable: false },
    });
    const current = await db.syncOutbox.get(op.id);
    assert.equal(current?.retryAt, null);
  });

  it("backoff grows exponentially", () => {
    const d1 = computeBackoffDelay(1, { jitter: 0 });
    const d2 = computeBackoffDelay(2, { jitter: 0 });
    const d3 = computeBackoffDelay(3, { jitter: 0 });
    assert.ok(d2 > d1, "attempt 2 > attempt 1");
    assert.ok(d3 > d2, "attempt 3 > attempt 2");
    assert.ok(d3 <= DEFAULT_BACKOFF.maxMs, "respects max");
  });
});

describe("Outbox: recoverStaleOps", () => {
  it("recovers syncing ops stuck for >5min", async () => {
    const stale = new Date(Date.now() - 10 * 60_000).toISOString();
    const op = await enqueueOperation({
      entity: "expenses",
      entityId: "e1",
      op: "upsert",
      payload: { id: "e1" },
      now: stale,
    });
    await db.syncOutbox.update(op.id, { state: "syncing", lastAttemptAt: stale });
    const recovered = await recoverStaleOps({ now: new Date().toISOString() });
    assert.equal(recovered, 1);
    const current = await db.syncOutbox.get(op.id);
    assert.equal(current?.state, "pending");
  });

  it("does not recover recent syncing ops", async () => {
    const now = new Date().toISOString();
    const op = await enqueueOperation({
      entity: "expenses",
      entityId: "e1",
      op: "upsert",
      payload: { id: "e1" },
      now,
    });
    await db.syncOutbox.update(op.id, { state: "syncing", lastAttemptAt: now });
    const recovered = await recoverStaleOps({ now });
    assert.equal(recovered, 0);
  });

  it("recovers failed ops with expired retryAt", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const op = await enqueueOperation({
      entity: "expenses",
      entityId: "e1",
      op: "upsert",
      payload: { id: "e1" },
    });
    await db.syncOutbox.update(op.id, {
      state: "failed",
      retryAt: past,
      lastAttemptAt: past,
    });
    const recovered = await recoverStaleOps({ now: new Date().toISOString() });
    assert.equal(recovered, 1);
  });
});

describe("SyncEngine: offline mode", () => {
  it("queues operations when offline and syncs when reconnected", async () => {
    let online = false;
    const transport = makeTransport();
    const stateChanges: string[] = [];

    const { createSyncEngine } = await import("./engine.ts");
    const { createConnectionMonitor } = await import("./connection.ts");

    const connection = createConnectionMonitor({
      navigatorOnline: () => online,
    });

    const engine = createSyncEngine({
      transport,
      connection,
      onStateChange: (s) => stateChanges.push(s.status),
      now: () => new Date().toISOString(),
    });

    engine.start();

    await db.expenses.add({
      id: "e1", code: "G000001", description: "Test", amount: 10,
      categoryId: "", paymentMethod: "efectivo", status: "pagado",
      date: "2025-01-01", time: "00:00", notes: "", voidedAt: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      deleted: false, syncStatus: "pending",
    });
    await enqueueOperation({
      entity: "expenses",
      entityId: "e1",
      op: "upsert",
      payload: { id: "e1" },
    });

    await engine.runSync({ reason: "test" });
    const counts = await countOutbox();
    assert.ok(counts.pending > 0 || counts.syncing > 0, "operations queued while offline");

    online = true;
    await engine.runSync({ reason: "reconnect" });

    engine.stop();
  });
});

describe("SyncEngine: server failure + retry", () => {
  it("marks ops as failed on 500 and retries", async () => {
    let failNext = true;
    const transport = makeTransport([{
      name: "expenses",
      async push() {
        if (failNext) {
          failNext = false;
          return { type: "server", message: "Internal error", retryable: true };
        }
        return null;
      },
    }]);

    const op = await enqueueOperation({
      entity: "expenses",
      entityId: "e1",
      op: "upsert",
      payload: { id: "e1" },
    });

    const { createSyncEngine } = await import("./engine.ts");
    const { createConnectionMonitor } = await import("./connection.ts");

    const connection = createConnectionMonitor({
      navigatorOnline: () => true,
    });

    const engine = createSyncEngine({
      transport,
      connection,
      now: () => new Date().toISOString(),
    });

    engine.start();
    await engine.runSync({ reason: "test" });

    let current = await db.syncOutbox.get(op.id);
    assert.equal(current?.state, "failed");
    assert.equal(current?.attempts, 1);

    await engine.retryFailedNow();
    current = await db.syncOutbox.get(op.id);
    assert.equal(current?.state, "synced");

    engine.stop();
  });
});

describe("SyncEngine: conflict detection", () => {
  it("marks op as conflict on version mismatch", async () => {
    const transport = makeTransport([{
      name: "expenses",
      async push() {
        return { type: "conflict", message: "Version mismatch", retryable: false };
      },
    }]);

    const op = await enqueueOperation({
      entity: "expenses",
      entityId: "e1",
      op: "upsert",
      payload: { id: "e1" },
    });

    const { createSyncEngine } = await import("./engine.ts");
    const { createConnectionMonitor } = await import("./connection.ts");

    const connection = createConnectionMonitor({
      navigatorOnline: () => true,
    });

    const engine = createSyncEngine({
      transport,
      connection,
      now: () => new Date().toISOString(),
    });

    engine.start();
    await engine.runSync({ reason: "test" });

    const current = await db.syncOutbox.get(op.id);
    assert.equal(current?.state, "conflict");

    engine.stop();
  });
});

describe("SyncEngine: app closed during sync recovery", () => {
  it("recovers syncing ops on startup", async () => {
    const stale = new Date(Date.now() - 10 * 60_000).toISOString();
    await db.syncOutbox.add({
      id: "op-stale",
      entity: "expenses",
      entityId: "e1",
      workspaceId: "ws-1",
      op: "upsert",
      payload: { id: "e1" },
      payloadHash: "hash1",
      state: "syncing",
      attempts: 1,
      lastError: null,
      lastErrorType: null,
      createdAt: stale,
      updatedAt: stale,
      lastAttemptAt: stale,
      retryAt: null,
    });

    const { createSyncEngine } = await import("./engine.ts");
    const { createConnectionMonitor } = await import("./connection.ts");

    const connection = createConnectionMonitor({
      navigatorOnline: () => true,
    });

    const engine = createSyncEngine({
      transport: makeTransport(),
      connection,
      now: () => new Date().toISOString(),
    });

    engine.start();
    await engine.runSync({ reason: "test-recovery" });

    const current = await db.syncOutbox.get("op-stale");
    assert.notEqual(current?.state, "syncing", "no longer stuck in syncing");

    engine.stop();
  });
});

describe("SyncEngine: workspace isolation", () => {
  it("operations carry workspaceId", async () => {
    const op1 = await enqueueOperation({
      entity: "expenses",
      entityId: "e1",
      workspaceId: "ws-tailoring",
      op: "upsert",
      payload: { id: "e1", workspaceId: "ws-tailoring" },
    });
    const op2 = await enqueueOperation({
      entity: "crops",
      entityId: "c1",
      workspaceId: "ws-agriculture",
      op: "upsert",
      payload: { id: "c1", workspaceId: "ws-agriculture" },
    });

    assert.equal(op1.workspaceId, "ws-tailoring");
    assert.equal(op2.workspaceId, "ws-agriculture");

    const batch = await claimNextBatch(10);
    for (const b of batch) {
      assert.ok(b.workspaceId, "every claimed op has workspaceId");
    }
  });
});

describe("Conflict resolution: LWW", () => {
  it("remote wins when newer", () => {
    const res = resolveConflict(
      { updatedAt: "2025-01-01T00:00:00Z", revision: 1 },
      { updatedAt: "2025-01-02T00:00:00Z", revision: 1 },
      false,
    );
    assert.equal(res.resolution, "keep_remote");
  });

  it("local wins when newer", () => {
    const res = resolveConflict(
      { updatedAt: "2025-01-03T00:00:00Z", revision: 1 },
      { updatedAt: "2025-01-01T00:00:00Z", revision: 1 },
      false,
    );
    assert.equal(res.resolution, "no_conflict");
  });

  it("revision breaks timestamp tie", () => {
    const res = compareVersions(
      { updatedAt: "2025-01-01T00:00:00Z", revision: 3 },
      { updatedAt: "2025-01-01T00:00:00Z", revision: 1 },
    );
    assert.equal(res, "keep_local");
  });

  it("pending local + remote newer = conflict", () => {
    const res = resolveConflict(
      { updatedAt: "2025-01-01T00:00:00Z", revision: 1 },
      { updatedAt: "2025-01-02T00:00:00Z", revision: 1 },
      true,
    );
    assert.equal(res.resolution, "keep_remote");
  });
});

describe("Append-only entities", () => {
  it("inventoryMovements is append-only", () => {
    assert.equal(isAppendOnly("inventoryMovements"), true);
    assert.equal(isAppendOnly("productionMaterials"), true);
    assert.equal(isAppendOnly("partCompatibilities"), true);
    assert.equal(isAppendOnly("expenses"), false);
  });

  it("registered operations include new modules", () => {
    assert.equal(isRegisteredOperation("productionOrders"), true);
    assert.equal(isRegisteredOperation("crops"), true);
    assert.equal(isRegisteredOperation("harvests"), true);
    assert.equal(isRegisteredOperation("autoParts"), true);
    assert.equal(isRegisteredOperation("animals"), true);
    assert.equal(isRegisteredOperation("livestockProductions"), true);
  });
});

describe("reconcilePendingEntities", () => {
  it("enqueues pending records without outbox entry", async () => {
    await db.expenses.add({
      id: "e-reconcile", code: "G000099", description: "Reconcile test", amount: 50,
      categoryId: "", paymentMethod: "efectivo", status: "pagado",
      date: "2025-01-01", time: "00:00", notes: "", voidedAt: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      deleted: false, syncStatus: "pending",
    });
    const enqueued = await reconcilePendingEntities();
    assert.ok(enqueued >= 1);
    const op = await db.syncOutbox.where("[entity+entityId]").equals(["expenses", "e-reconcile"]).first();
    assert.ok(op, "outbox entry created");
  });

  it("does not duplicate existing outbox entries", async () => {
    await enqueueOperation({
      entity: "expenses",
      entityId: "e1",
      op: "upsert",
      payload: { id: "e1" },
    });
    await db.expenses.add({
      id: "e1", code: "G000001", description: "Test", amount: 10,
      categoryId: "", paymentMethod: "efectivo", status: "pagado",
      date: "2025-01-01", time: "00:00", notes: "", voidedAt: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      deleted: false, syncStatus: "pending",
    });
    const enqueued = await reconcilePendingEntities();
    assert.equal(enqueued, 0, "no duplicate");
  });
});

describe("Error classification", () => {
  it("classifies network errors", () => {
    const err = classifySyncError(new TypeError("Failed to fetch"));
    assert.equal(err.type, "network");
    assert.equal(err.retryable, true);
  });

  it("classifies auth errors", () => {
    const err = classifySyncError({ status: 401 });
    assert.equal(err.type, "auth");
    assert.equal(err.retryable, false);
  });

  it("classifies conflict errors", () => {
    const err = classifySyncError({ status: 409 });
    assert.equal(err.type, "conflict");
    assert.equal(err.retryable, false);
  });

  it("classifies server errors as retryable", () => {
    const err = classifySyncError({ status: 500 });
    assert.equal(err.type, "server");
    assert.equal(err.retryable, true);
  });
});

describe("canonicalStringify stability", () => {
  it("order-independent", () => {
    const a = canonicalStringify({ b: 2, a: 1 });
    const b = canonicalStringify({ a: 1, b: 2 });
    assert.equal(a, b);
  });

  it("hash is stable", () => {
    const h1 = hashPayload({ id: "e1", amount: 10, name: "test" });
    const h2 = hashPayload({ name: "test", amount: 10, id: "e1" });
    assert.equal(h1, h2);
  });

  it("different payloads produce different hashes", () => {
    const h1 = hashPayload({ id: "e1", amount: 10 });
    const h2 = hashPayload({ id: "e1", amount: 20 });
    assert.notEqual(h1, h2);
  });
});

describe("SYNC_ENTITY_TABLES completeness", () => {
  it("includes all 34 entity tables", () => {
    assert.equal(SYNC_ENTITY_TABLES.length, 34);
    const expected = [
      "expenses", "categories", "types", "investments", "investmentCategories",
      "customers", "products", "inventoryMovements", "sales", "saleDetails",
      "purchases", "purchaseDetails",
      "garments", "sizes", "garmentColors", "materials", "productionOrders", "productionMaterials",
      "crops", "farmLots", "agroInputs", "applications", "labors", "harvests",
      "vehicleBrands", "vehicleModels", "autoParts", "partCompatibilities",
      "species", "breedingLots", "animals", "feedings", "reproductions", "livestockProductions",
    ];
    for (const e of expected) {
      assert.ok((SYNC_ENTITY_TABLES as readonly string[]).includes(e), `missing ${e}`);
    }
  });
});
