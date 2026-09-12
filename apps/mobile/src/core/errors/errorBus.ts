import { create } from 'zustand';

export interface GlobalErrorEvent {
  message: string;
  code?: string;
  occurredAt: string;
}

interface ErrorBusState {
  current: GlobalErrorEvent | null;
  emit: (message: string, code?: string) => void;
  clear: () => void;
}

export const useErrorBus = create<ErrorBusState>((set) => ({
  current: null,
  emit: (message, code) =>
    set({ current: { message, code, occurredAt: new Date().toISOString() } }),
  clear: () => set({ current: null }),
}));

export function emitGlobalError(message: string, code?: string): void {
  useErrorBus.getState().emit(message, code);
}
