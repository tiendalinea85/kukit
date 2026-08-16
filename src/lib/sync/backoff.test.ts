import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  backoffSequence,
  clampBackoffDelay,
  computeBackoffDelay,
  withJitter,
} from "./backoff.ts";

describe("computeBackoffDelay", () => {
  it("devuelve 0 con 0 intentos", () => {
    assert.equal(computeBackoffDelay(0), 0);
  });

  it("crece exponencialmente con jitter 0", () => {
    const options = { baseMs: 1000, factor: 2, jitter: 0 };
    assert.equal(computeBackoffDelay(1, options, () => 0.5), 1000);
    assert.equal(computeBackoffDelay(2, options, () => 0.5), 2000);
    assert.equal(computeBackoffDelay(3, options, () => 0.5), 4000);
  });

  it("aplica el tope máximo", () => {
    const options = { baseMs: 1000, factor: 2, maxMs: 2500, jitter: 0 };
    assert.equal(computeBackoffDelay(4, options, () => 0.5), 2500);
  });

  it("la secuencia esperada coincide con backoffSequence", () => {
    assert.deepEqual(backoffSequence(3, { baseMs: 1000, factor: 2, jitter: 0 }), [1000, 2000, 4000]);
    assert.deepEqual(backoffSequence(5, { baseMs: 500, factor: 3, maxMs: 5000, jitter: 0 }), [
      500, 1500, 4500, 5000, 5000,
    ]);
  });

  it("nunca excede maxMs incluso con jitter", () => {
    const options = { baseMs: 1000, factor: 2, maxMs: 60000, jitter: 0.2 };
    for (let i = 1; i <= 12; i++) {
      const d = computeBackoffDelay(i, options, () => 0.99);
      assert.ok(d <= 60000, `delay ${d} excede el tope`);
    }
  });
});

describe("clampBackoffDelay", () => {
  it("acota por abajo y por arriba", () => {
    assert.equal(clampBackoffDelay(-5, 1000), 0);
    assert.equal(clampBackoffDelay(5000, 1000), 1000);
    assert.equal(clampBackoffDelay(123.456, 10000), 123);
  });
});

describe("withJitter", () => {
  it("devuelve el valor base con random 0.5", () => {
    assert.equal(withJitter(1000, 0.2, () => 0.5), 1000);
  });

  it("permanece dentro del rango ±jitter", () => {
    for (const r of [0, 0.25, 0.5, 0.75, 1]) {
      const v = withJitter(1000, 0.2, () => r);
      assert.ok(v >= 800 && v <= 1200, `fuera de rango: ${v}`);
    }
  });
});
