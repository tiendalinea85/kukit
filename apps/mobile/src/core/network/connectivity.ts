import * as Network from 'expo-network';
import { create } from 'zustand';
import { apiClient } from '../sync/apiClient';
import { logger } from '../logging';
import { nowIso } from '../utils/id';
import { decideOnline, deviceHasNetwork, type DeviceNetworkState } from './connectivityLogic';

const netLogger = logger.child('net');

interface ConnectivityState {
  deviceConnected: boolean;
  serverReachable: boolean;
  online: boolean;
  checking: boolean;
  lastCheckedAt: string | null;
  setNetworkState: (state: DeviceNetworkState) => void;
  setServerReachable: (reachable: boolean) => void;
  checkNow: () => Promise<void>;
}

export const useConnectivityStore = create<ConnectivityState>((set, get) => ({
  deviceConnected: false,
  serverReachable: false,
  online: false,
  checking: false,
  lastCheckedAt: null,

  setNetworkState: (state) => {
    const deviceConnected = deviceHasNetwork(state);
    const online = decideOnline(deviceConnected, get().serverReachable);
    set({ deviceConnected, online, lastCheckedAt: nowIso() });
  },

  setServerReachable: (serverReachable) => {
    const online = decideOnline(get().deviceConnected, serverReachable);
    set({ serverReachable, online, lastCheckedAt: nowIso() });
  },

  checkNow: async () => {
    if (get().checking) return;
    set({ checking: true });
    try {
      const reachable = await apiClient.health();
      get().setServerReachable(reachable);
    } catch (error) {
      netLogger.warn('Health check del servidor falló', { error: String(error) });
      get().setServerReachable(false);
    } finally {
      set({ checking: false });
    }
  },
}));

type Subscription = { remove(): void };

let subscription: Subscription | null = null;

export function startConnectivityMonitoring(onStatusChange?: (online: boolean) => void): () => void {
  const refresh = async (): Promise<void> => {
    const before = useConnectivityStore.getState().online;
    await useConnectivityStore.getState().checkNow();
    const after = useConnectivityStore.getState().online;
    if (before !== after) onStatusChange?.(after);
  };

  void (async () => {
    try {
      const state = await Network.getNetworkStateAsync();
      useConnectivityStore.getState().setNetworkState(state);
    } catch (error) {
      netLogger.error('No se pudo leer el estado de red', error);
    }
    await refresh();
  })();

  subscription = Network.addNetworkStateListener((state) => {
    useConnectivityStore.getState().setNetworkState(state);
    void refresh();
  });

  return () => {
    subscription?.remove();
    subscription = null;
  };
}

export function stopConnectivityMonitoring(): void {
  subscription?.remove();
  subscription = null;
}
