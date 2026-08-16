import { create } from "zustand";
import type { SyncEngineState } from "../../types/sync.ts";

// Store global del estado de sincronización (expuesto a la UI).
// El motor actualiza el estado mediante `hydrate`; las acciones manuales
// delegan en el motor registrado en `registerEngineActions` (bootstrapping).

export interface SyncEngineActions {
  manualSync: () => Promise<void>;
  retryNow: () => Promise<void>;
}

export interface SyncStoreState extends SyncEngineState {
  initialized: boolean;
  hydrate: (state: SyncEngineState) => void;
  registerEngineActions: (actions: SyncEngineActions) => void;
  manualSync: () => Promise<void>;
  retryNow: () => Promise<void>;
}

const noopEngine: SyncEngineActions = {
  manualSync: async () => {},
  retryNow: async () => {},
};

let engineActions: SyncEngineActions = noopEngine;

export const useSyncStore = create<SyncStoreState>((set) => ({
  online: true,
  status: "idle",
  lastSyncedAt: null,
  lastError: null,
  pendingCount: 0,
  syncingCount: 0,
  failedCount: 0,
  conflictCount: 0,
  lastPushAt: null,
  lastPullAt: null,
  history: [],
  initialized: false,

  hydrate: (state) => set({ ...state, initialized: true }),
  registerEngineActions: (actions) => {
    engineActions = actions;
  },
  manualSync: async () => engineActions.manualSync(),
  retryNow: async () => engineActions.retryNow(),
}));
