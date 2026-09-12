import * as SecureStore from 'expo-secure-store';

export const SecureKeys = {
  supabaseSession: 'supabase.auth.token',
} as const;

export interface SecureStorageAdapter {
  getItem(name: string): Promise<string | null>;
  setItem(name: string, value: string): Promise<void>;
  removeItem(name: string): Promise<void>;
}

export const secureStorage: SecureStorageAdapter = {
  getItem: (name) => SecureStore.getItemAsync(name),
  setItem: (name, value) => SecureStore.setItemAsync(name, value),
  removeItem: (name) => SecureStore.deleteItemAsync(name),
};
