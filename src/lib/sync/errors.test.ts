import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifySyncError,
  classifyWriteResponse,
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

describe("classifySyncError: estados HTTP (O2/O3)", () => {
  it("maps 429 to a retryable server error", () => {
    const info = classifySyncError({ status: 429, message: "Too Many Requests" });
    assert.equal(info.type, "server");
    assert.ok(info.retryable);
  });

  it("maps 408 to a retryable timeout", () => {
    const info = classifySyncError({ status: 408, message: "Request Timeout" });
    assert.equal(info.type, "timeout");
    assert.ok(info.retryable);
  });

  it("maps 500, 502, 503 and 504 to retryable server errors", () => {
    for (const status of [500, 502, 503, 504]) {
      const info = classifySyncError({ status, message: `boom ${status}` });
      assert.equal(info.type, "server", `status ${status}`);
      assert.ok(info.retryable, `status ${status}`);
    }
  });

  it("maps 400 to a permanent validation error", () => {
    const info = classifySyncError({ status: 400, message: "bad request" });
    assert.equal(info.type, "validation");
    assert.ok(!info.retryable);
  });

  it("maps 404 to a retryable server error (self-healing)", () => {
    const info = classifySyncError({ status: 404, message: "not found" });
    assert.equal(info.type, "server");
    assert.ok(info.retryable);
  });

  it("maps status 0 (rejected fetch) to a retryable network error", () => {
    const info = classifySyncError({ status: 0, code: "", message: "FetchError: Failed to fetch" });
    assert.equal(info.type, "network");
    assert.ok(info.retryable);
  });

  it("maps an abort packed by postgrest-js to a retryable timeout", () => {
    const info = classifySyncError({ status: 0, message: "AbortError: The user aborted a request." });
    assert.equal(info.type, "timeout");
    assert.ok(info.retryable);
  });
});

describe("classifySyncError: 409 según el contenido real", () => {
  it("maps a unique violation to a permanent validation error", () => {
    const info = classifySyncError({
      status: 409,
      message: "duplicate key value violates unique constraint \"idx_expenses_user_code\"",
    });
    assert.equal(info.type, "validation");
    assert.ok(!info.retryable);
  });

  it("maps a transient transaction collision to a retryable server error", () => {
    const info = classifySyncError({
      status: 409,
      message: "could not serialize access due to concurrent update",
    });
    assert.equal(info.type, "server");
    assert.ok(info.retryable);
  });

  it("maps a revision conflict with no further hints to a permanent conflict", () => {
    const info = classifySyncError({ status: 409, message: "conflicting row version" });
    assert.equal(info.type, "conflict");
    assert.ok(!info.retryable);
  });
});

describe("classifySyncError: errores de esquema sin reintentos infinitos", () => {
  it("maps PGRST204 for 'category_id' to a permanent validation error", () => {
    const info = classifySyncError({
      status: 400,
      code: "PGRST204",
      message: "Could not find the 'category_id' column of 'expenses' in the schema cache",
    });
    assert.equal(info.type, "validation");
    assert.ok(!info.retryable);
  });

  it("maps PGRST116 (multiple rows) to a permanent validation error", () => {
    const info = classifySyncError({
      status: 406,
      code: "PGRST116",
      message: "Results contain 2 rows, application/vnd.pgrst.object+json requires 1 row",
    });
    assert.equal(info.type, "validation");
    assert.ok(!info.retryable);
  });

  it("keeps PGRST205 (missing table) retryable for self-healing", () => {
    const info = classifySyncError({ status: 404, code: "PGRST205", message: "Could not find the table" });
    assert.equal(info.type, "server");
    assert.ok(info.retryable);
  });
});

describe("classifyWriteResponse: ACK real (O5)", () => {
  it("accepts a 204 without error as an ack", () => {
    assert.equal(classifyWriteResponse({ error: null, status: 204 }), null);
  });

  it("accepts a 200 without error as an ack", () => {
    assert.equal(classifyWriteResponse({ error: null, status: 200 }), null);
  });

  it("rejects a response without status as an ack", () => {
    const info = classifyWriteResponse({ error: null });
    assert.ok(info, "no se puede dar por buena una respuesta sin status");
    assert.equal(info!.type, "network");
    assert.ok(info!.retryable);
  });

  it("rejects a 500 without error as an ack", () => {
    const info = classifyWriteResponse({ error: null, status: 500 });
    assert.equal(info!.type, "server");
    assert.ok(info!.retryable);
  });

  it("treats a rejected fetch (status 0) as a retryable network error", () => {
    const info = classifyWriteResponse({ error: { message: "FetchError: Failed to fetch", code: "" }, status: 0 });
    assert.equal(info!.type, "network");
    assert.ok(info!.retryable);
  });

  it("rejects a 2xx carrying an unexpected body as a permanent error", () => {
    const info = classifyWriteResponse({ error: { message: "<html>maintenance</html>" }, status: 200 });
    assert.equal(info!.type, "validation");
    assert.ok(!info!.retryable);
  });

  it("classifies a contextless error with the real response status", () => {
    const info = classifyWriteResponse({ error: { message: "<html>bad gateway</html>" }, status: 502 });
    assert.equal(info!.type, "server");
    assert.ok(info!.retryable);
  });

  it("rejects an empty (null) response as an ack", () => {
    assert.ok(classifyWriteResponse(null));
    assert.ok(classifyWriteResponse(undefined));
  });
});
