import type { ExpenseStatus } from '../../../core/domain/types';

export const EXPENSE_STATUSES = ['activo', 'pendiente', 'pagado', 'cancelado'] as const satisfies readonly ExpenseStatus[];

export const PAYMENT_METHODS = ['efectivo', 'tarjeta', 'transferencia', 'otro'] as const;

/** Un gasto anulado (cancelado) no se puede editar ni anular de nuevo. */
export function canEditExpense(status: ExpenseStatus): boolean {
  return status !== 'cancelado';
}

export function canVoidExpense(status: ExpenseStatus): boolean {
  return status !== 'cancelado';
}

export function isVoided(status: ExpenseStatus): boolean {
  return status === 'cancelado';
}
