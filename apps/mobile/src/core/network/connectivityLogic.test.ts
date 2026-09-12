import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decideOnline, deviceHasNetwork } from './connectivityLogic.ts';

describe('connectivityLogic', () => {
  it('deviceHasNetwork requiere conexión de red Y acceso a internet', () => {
    assert.equal(deviceHasNetwork({ isConnected: true, isInternetReachable: true }), true);
    assert.equal(deviceHasNetwork({ isConnected: true, isInternetReachable: false }), false);
    assert.equal(deviceHasNetwork({ isConnected: false, isInternetReachable: true }), false);
    assert.equal(deviceHasNetwork({ isConnected: false }), false);
    assert.equal(deviceHasNetwork({}), false);
  });

  it('decideOnline requiere red del dispositivo Y servidor alcanzable', () => {
    assert.equal(decideOnline(true, true), true);
    assert.equal(decideOnline(true, false), false);
    assert.equal(decideOnline(false, true), false);
    assert.equal(decideOnline(false, false), false);
  });
});
