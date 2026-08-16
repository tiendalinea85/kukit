import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createConnectionMonitor } from "./connection.ts";

function makeFetch(handler: (url: string, init: RequestInit) => Promise<Response> | Response): typeof fetch {
  return (async (url: unknown, init?: unknown) => {
    const res = await handler(String(url), (init ?? {}) as RequestInit);
    return res as Response;
  }) as typeof fetch;
}

describe("createConnectionMonitor", () => {
  it("sin heartbeat: online sigue a navigator", () => {
    const mon = createConnectionMonitor({ navigatorOnline: () => true, heartbeatUrl: null });
    assert.equal(mon.getState().online, true);
    mon.stop();
  });

  it("offline si navigator reporta offline", () => {
    const mon = createConnectionMonitor({ navigatorOnline: () => false, heartbeatUrl: null });
    assert.equal(mon.getState().online, false);
    mon.stop();
  });

  it("heartbeat OK mantiene online y registra latencia", async () => {
    const fetchImpl = makeFetch(() => new Response(null, { status: 200 }));
    const mon = createConnectionMonitor({
      navigatorOnline: () => true,
      heartbeatUrl: "https://api.example/health",
      fetchImpl,
    });
    const states: boolean[] = [];
    const unsub = mon.onChange((s) => states.push(s.online));
    mon.start();
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(mon.getState().online, true);
    assert.ok(mon.getState().latencyMs !== null);
    assert.ok(states.includes(true));
    unsub();
    mon.stop();
  });

  it("heartbeat fallido declara offline aunque navigator diga online", async () => {
    const fetchImpl = makeFetch(() => {
      throw new TypeError("fetch failed");
    });
    const mon = createConnectionMonitor({
      navigatorOnline: () => true,
      heartbeatUrl: "https://api.example/health",
      fetchImpl,
      heartbeatTimeoutMs: 100,
    });
    mon.start();
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(mon.getState().online, false);
    mon.stop();
  });

  it("respuesta no-OK del heartbeat declara offline", async () => {
    const fetchImpl = makeFetch(() => new Response(null, { status: 500 }));
    const mon = createConnectionMonitor({
      navigatorOnline: () => true,
      heartbeatUrl: "https://api.example/health",
      fetchImpl,
    });
    mon.start();
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(mon.getState().online, false);
    mon.stop();
  });

  it("onChange notifica inmediatamente con el estado actual", () => {
    const mon = createConnectionMonitor({ navigatorOnline: () => true, heartbeatUrl: null });
    const seen: boolean[] = [];
    const unsub = mon.onChange((s) => seen.push(s.online));
    assert.deepEqual(seen, [true]);
    unsub();
    mon.stop();
  });

  it("onChange se desuscribe correctamente", () => {
    const mon = createConnectionMonitor({ navigatorOnline: () => true, heartbeatUrl: null });
    let calls = 0;
    const unsub = mon.onChange(() => calls++);
    unsub();
    mon.start();
    mon.stop();
    assert.equal(calls, 1);
  });

  it("stop detiene el heartbeat (no se vuelve a emitir)", async () => {
    let calls = 0;
    const fetchImpl = makeFetch(() => {
      calls++;
      return new Response(null, { status: 200 });
    });
    const mon = createConnectionMonitor({
      navigatorOnline: () => true,
      heartbeatUrl: "https://api.example/health",
      fetchImpl,
      heartbeatIntervalMs: 5,
    });
    mon.start();
    await new Promise((r) => setTimeout(r, 40));
    mon.stop();
    const before = calls;
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(calls, before);
  });
});
