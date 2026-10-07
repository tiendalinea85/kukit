import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { newId } from "../utils/id.ts";

// UUID v4 canónico: 8-4-4-4-12 hex, versión 4 y variante 10. Supabase guarda
// estos ids en columnas `uuid`, así que el fallback DEBE cumplir el formato.
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, "crypto");

function stubCrypto(value: unknown): void {
  Object.defineProperty(globalThis, "crypto", { value, configurable: true, writable: true });
}

afterEach(() => {
  if (originalCrypto) Object.defineProperty(globalThis, "crypto", originalCrypto);
});

describe("newId", () => {
  it("devuelve un UUID v4 válido con crypto.randomUUID disponible", () => {
    assert.match(newId(), UUID_V4);
  });

  it("no repite ids", () => {
    const ids = new Set(Array.from({ length: 500 }, () => newId()));
    assert.equal(ids.size, 500);
  });

  it("cae a getRandomValues cuando randomUUID no existe (origen no seguro)", () => {
    // Es exactamente el caso iOS + http://192.168.x.x:3000.
    stubCrypto({
      getRandomValues: (bytes: Uint8Array) => {
        for (let i = 0; i < bytes.length; i++) bytes[i] = i * 16 + 7;
        return bytes;
      },
    });

    const id = newId();
    assert.match(id, UUID_V4);
  });

  it("el fallback determinista fuerza versión 4 y variante RFC 4122", () => {
    // Todos los bytes a 0xff: sin corregir los bits, el resultado sería
    // ffffffff-ffff-ffff-ffff-ffffffffffff y no sería un v4 válido.
    stubCrypto({
      getRandomValues: (bytes: Uint8Array) => bytes.fill(0xff),
    });

    assert.equal(newId(), "ffffffff-ffff-4fff-bfff-ffffffffffff");
  });

  it("usa Math.random como último recurso si no hay crypto", () => {
    stubCrypto(undefined);

    const ids = Array.from({ length: 200 }, () => newId());
    for (const id of ids) assert.match(id, UUID_V4);
    assert.equal(new Set(ids).size, 200);
  });
});