import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  compareVersions,
  isAppendOnly,
  isRegisteredOperation,
  resolveConflict,
} from "./conflicts.ts";

describe("compareVersions (LWW + revisión)", () => {
  it("gana el local si su updatedAt es más reciente", () => {
    assert.equal(
      compareVersions({ updatedAt: "2026-01-02T00:00:00.000Z", revision: 1 }, { updatedAt: "2026-01-01T00:00:00.000Z", revision: 5 }),
      "keep_local",
    );
  });

  it("gana el remoto si su updatedAt es más reciente", () => {
    assert.equal(
      compareVersions({ updatedAt: "2026-01-01T00:00:00.000Z", revision: 9 }, { updatedAt: "2026-01-03T00:00:00.000Z", revision: 1 }),
      "keep_remote",
    );
  });

  it("empate de timestamp → gana mayor revisión", () => {
    assert.equal(
      compareVersions({ updatedAt: "2026-01-01T00:00:00.000Z", revision: 2 }, { updatedAt: "2026-01-01T00:00:00.000Z", revision: 5 }),
      "keep_remote",
    );
    assert.equal(
      compareVersions({ updatedAt: "2026-01-01T00:00:00.000Z", revision: 7 }, { updatedAt: "2026-01-01T00:00:00.000Z", revision: 5 }),
      "keep_local",
    );
  });

  it("empate completo → gana el local", () => {
    assert.equal(
      compareVersions({ updatedAt: "2026-01-01T00:00:00.000Z", revision: 3 }, { updatedAt: "2026-01-01T00:00:00.000Z", revision: 3 }),
      "tie_local",
    );
  });

  it("fechas inválidas se tratan como 0", () => {
    assert.equal(
      compareVersions({ updatedAt: "no-es-fecha", revision: 1 }, { updatedAt: "2026-01-01T00:00:00.000Z", revision: 1 }),
      "keep_remote",
    );
  });
});

describe("resolveConflict", () => {
  it("local ya sincronizado y remoto más nuevo → keep_remote", () => {
    const res = resolveConflict(
      { updatedAt: "2026-01-01T00:00:00.000Z", revision: 1 },
      { updatedAt: "2026-01-02T00:00:00.000Z", revision: 1 },
      false,
    );
    assert.equal(res.resolution, "keep_remote");
    assert.deepEqual(res.winner, { updatedAt: "2026-01-02T00:00:00.000Z", revision: 1 });
  });

  it("local ya sincronizado y local más nuevo → no_conflict", () => {
    const res = resolveConflict(
      { updatedAt: "2026-01-02T00:00:00.000Z", revision: 1 },
      { updatedAt: "2026-01-01T00:00:00.000Z", revision: 1 },
      false,
    );
    assert.equal(res.resolution, "no_conflict");
  });

  it("local pendiente y remoto más nuevo → keep_remote (conflicto)", () => {
    const res = resolveConflict(
      { updatedAt: "2026-01-01T00:00:00.000Z", revision: 1 },
      { updatedAt: "2026-01-02T00:00:00.000Z", revision: 1 },
      true,
    );
    assert.equal(res.resolution, "keep_remote");
  });

  it("local pendiente y local más nuevo → keep_local", () => {
    const res = resolveConflict(
      { updatedAt: "2026-01-02T00:00:00.000Z", revision: 1 },
      { updatedAt: "2026-01-01T00:00:00.000Z", revision: 1 },
      true,
    );
    assert.equal(res.resolution, "keep_local");
  });

  it("local pendiente y empate completo → tie_local (gana local)", () => {
    const res = resolveConflict(
      { updatedAt: "2026-01-01T00:00:00.000Z", revision: 2 },
      { updatedAt: "2026-01-01T00:00:00.000Z", revision: 2 },
      true,
    );
    assert.equal(res.resolution, "tie_local");
  });
});

describe("operaciones registradas / append-only", () => {
  it("los movimientos de inventario son append-only", () => {
    assert.ok(isAppendOnly("inventoryMovements"));
    assert.ok(!isAppendOnly("expenses"));
  });

  it("las operaciones históricas están registradas", () => {
    for (const e of ["sales", "saleDetails", "purchases", "purchaseDetails", "expenses", "investments", "inventoryMovements"]) {
      assert.ok(isRegisteredOperation(e), `${e} debería ser registrada`);
    }
    assert.ok(!isRegisteredOperation("categories"));
    assert.ok(!isRegisteredOperation("products"));
  });
});
