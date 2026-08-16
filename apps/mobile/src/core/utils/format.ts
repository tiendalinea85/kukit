const CURRENCY = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2,
});

export function formatMoney(cents: number): string {
  return CURRENCY.format(cents / 100);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 }).format(value);
}

export function formatDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
