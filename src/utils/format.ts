export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(amount);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
  }).format(new Date(dateStr));
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr) return "";
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(dateStr));
}
