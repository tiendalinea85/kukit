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

  it("detecta mensajes de duplicado como validation", () => {
    const info = classifySyncError(new Error("duplicate key value violates unique constraint"));
    assert.equal(info.type, "validation");
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
