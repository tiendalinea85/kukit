import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifySyncError,
  isPermanentError,
  isRetryableError,
} from "./errors.ts";

describe("classifySyncError", () => {
  it("clasifica como network cuando estamos offline", () => {
    const info = classifySyncError(new Error("cualquiera"), { offline: true });
    assert.equal(info.type, "network");
    assert.ok(info.retryable);
  });

  it("clasifica AbortError como timeout retryable", () => {
    const err = new Error("abortado");
    (err as { name?: string }).name = "AbortError";
    const info = classifySyncError(err);
    assert.equal(info.type, "timeout");
    assert.ok(info.retryable);
  });

  it("clasifica errores de fetch como network", () => {
    const info = classifySyncError(new TypeError("fetch failed"));
    assert.equal(info.type, "network");
    assert.ok(info.retryable);
  });

  it("clasifica 500 como server retryable", () => {
    const info = classifySyncError({ status: 500, message: "boom" });
    assert.equal(info.type, "server");
    assert.ok(info.retryable);
  });

  it("clasifica 401 como auth no retryable", () => {
    const info = classifySyncError({ status: 401, message: "unauthorized" });
    assert.equal(info.type, "auth");
    assert.ok(!isRetryableError(info));
  });

  it("clasifica 409 como conflict no retryable", () => {
    const info = classifySyncError({ status: 409, message: "conflict" });
    assert.equal(info.type, "conflict");
    assert.ok(!isRetryableError(info));
  });

  it("clasifica 422 como validation no retryable", () => {
    const info = classifySyncError({ status: 422, message: "rechazado" });
    assert.equal(info.type, "validation");
    assert.ok(!isRetryableError(info));
  });

  it("clasifica 404 como server retryable (auto-reparación)", () => {
    const info = classifySyncError({
      status: 404,
      message: 'relation "expense_details" does not exist',
    });
    assert.equal(info.type, "server");
    assert.ok(isRetryableError(info));
  });

  it("detecta mensajes de duplicado como validation", () => {
    const info = classifySyncError(new Error("duplicate key value violates unique constraint"));
    assert.equal(info.type, "validation");
  });

  it("classifies a PostgREST RLS denial (SQLSTATE 42501) as a permanent auth error", () => {
    const info = classifySyncError({
      code: "42501",
      message: 'new row violates row-level security policy for table "purchases"',
    });
    assert.equal(info.type, "auth");
    assert.ok(!isRetryableError(info));
    assert.ok(isPermanentError(info.type));
  });

  it("does not read a SQLSTATE code as an HTTP status", () => {
    const info = classifySyncError({ code: "42501", message: "boom" });
    assert.notEqual(info.type, "server");
  });

  it("classifies a unique violation (SQLSTATE 23505) as a permanent validation error", () => {
    const info = classifySyncError({
      code: "23505",
      message: 'duplicate key value violates unique constraint "idx_expenses_user_code"',
    });
    assert.equal(info.type, "validation");
    assert.ok(!isRetryableError(info));
  });

  it("keeps a foreign key violation (SQLSTATE 23503) retryable", () => {
    const info = classifySyncError({
      code: "23503",
      message: "insert or update on table expense_details violates foreign key constraint",
    });
    assert.equal(info.type, "server");
    assert.ok(isRetryableError(info));
  });

  it("classifies a missing table or column (PGRST205) as a retryable server error", () => {
    const info = classifySyncError({ code: "PGRST205", message: "Could not find the table" });
    assert.equal(info.type, "server");
    assert.ok(isRetryableError(info));
  });

  it("classifies an expired JWT (PGRST301) as a permanent auth error", () => {
    const info = classifySyncError({ code: "PGRST301", message: "JWT expired" });
    assert.equal(info.type, "auth");
    assert.ok(!isRetryableError(info));
  });

  it("detecta mensajes de append-only como conflict", () => {
    const info = classifySyncError(new Error("append-only: movimiento registrado"));
    assert.equal(info.type, "conflict");
  });

  it("clasifica lo desconocido como retryable", () => {
    const info = classifySyncError(new Error("algo raro"));
    assert.equal(info.type, "unknown");
    assert.ok(info.retryable);
  });
});

describe("isPermanentError", () => {
  it("valida solo errores permanentes", () => {
    assert.ok(isPermanentError("validation"));
    assert.ok(isPermanentError("conflict"));
    assert.ok(isPermanentError("auth"));
    assert.ok(!isPermanentError("network"));
    assert.ok(!isPermanentError("timeout"));
    assert.ok(!isPermanentError("server"));
    assert.ok(!isPermanentError("unknown"));
  });
});
