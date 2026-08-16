import * as Crypto from 'expo-crypto';

export function newId(): string {
  return Crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nowTime(): string {
  return new Date().toTimeString().slice(0, 8);
}

const PREFIXES: Record<string, string> = {
  product: 'PRD',
  category: 'CAT',
  purchase: 'COM',
  expense: 'GAS',
  investment: 'INV',
  client: 'CLI',
  sale: 'VEN',
  expense_type: 'TGA',
};

export function buildCode(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(4, '0')}`;
}

export function extractSequence(code: string): number {
  const match = code.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

export function nextCode(existing: string[]): string {
  const max = existing.reduce((acc, c) => Math.max(acc, extractSequence(c)), 0);
  return buildCode('GEN', max + 1);
}
