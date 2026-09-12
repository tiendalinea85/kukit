import { getDb } from '../../core/db/database';
import { nextCodeFor, softDelete, upsert, writeTx, type DbLike } from '../../core/db/repo';
import { enqueueAudit, enqueueOutbox } from '../../core/db/outbox';
import type { Expense, ExpenseDetail } from '../../core/domain/types';
import { newId, nowIso } from '../../core/utils/id';
import { requireActiveWorkspaceId } from '../../core/workspace/isolation';
import type { SQLiteBindValue } from 'expo-sqlite';

export interface ExpenseFilters {
  search?: string;
  categoryId?: string | null;
  status?: string | null;
  paymentMethod?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  voided?: boolean | null;
}

export async function listExpenses(): Promise<Expense[]> {
  const db = await getDb();
  const wsId = await requireActiveWorkspaceId();
  return db.getAllAsync<Expense>(
    `SELECT e.*, c.name as category_name, t.name as type_name
     FROM expenses e
     LEFT JOIN categories c ON c.id = e.category_id
     LEFT JOIN expense_types t ON t.id = e.type_id
     WHERE e.deleted = 0 AND e.workspace_id = ? ORDER BY e.date DESC, e.created_at DESC`,
    wsId
  );
}

export async function searchExpenses(filters: ExpenseFilters = {}): Promise<Expense[]> {
  const db = await getDb();
  const wsId = await requireActiveWorkspaceId();
  const conditions = ['e.deleted = 0', 'e.workspace_id = ?'];
  const params: SQLiteBindValue[] = [wsId];

  const search = (filters.search ?? '').trim();
  if (search) {
    const like = `%${search}%`;
    conditions.push('(e.code LIKE ? OR e.name LIKE ? OR e.description LIKE ? OR c.name LIKE ?)');
    params.push(like, like, like, like);
  }
  if (filters.categoryId) {
    conditions.push('e.category_id = ?');
    params.push(filters.categoryId);
  }
  if (filters.status) {
    conditions.push('e.status = ?');
    params.push(filters.status);
  }
  if (filters.paymentMethod) {
    conditions.push('e.payment_method = ?');
    params.push(filters.paymentMethod);
  }
  if (filters.dateFrom) {
    conditions.push('e.date >= ?');
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push('e.date <= ?');
    params.push(filters.dateTo);
  }
  if (filters.voided === true) {
    conditions.push("e.status = 'cancelado'");
  } else if (filters.voided === false) {
    conditions.push("e.status != 'cancelado'");
  }

  return db.getAllAsync<Expense>(
    `SELECT e.*, c.name as category_name, t.name as type_name
     FROM expenses e
     LEFT JOIN categories c ON c.id = e.category_id
     LEFT JOIN expense_types t ON t.id = e.type_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY e.date DESC, e.created_at DESC`,
    ...params
  );
}

export async function getExpense(id: string): Promise<Expense | null> {
  const db = await getDb();
  const expense = await db.getFirstAsync<Expense>('SELECT * FROM expenses WHERE id = ?', id);
  if (!expense) return null;
  expense.details = await db.getAllAsync<ExpenseDetail>(
    'SELECT * FROM expense_details WHERE expense_id = ? ORDER BY id',
    id
  );
  return expense;
}

export interface ExpenseForm {
  id?: string;
  name: string;
  description: string;
  amount: number;
  category_id: string | null;
  type_id: string | null;
  payment_method: Expense['payment_method'];
  status: Expense['status'];
  date: string;
  time: string;
  notes: string;
  details: Omit<ExpenseDetail, 'id' | 'expense_id' | 'subtotal'>[];
}

export async function saveExpense(form: ExpenseForm): Promise<Expense> {
  const db = await getDb();
  const wsId = await requireActiveWorkspaceId();
  const existing = form.id ? await getExpense(form.id) : null;

  const hasDetails = form.details.length > 0;
  const detailsTotal = form.details.reduce((acc, d) => acc + Math.round(d.quantity * d.unit_price), 0);
  const total = hasDetails ? detailsTotal : Math.round(form.amount);

  const now = nowIso();
  const id = form.id ?? newId();
  const row: Expense = {
    id,
    code: existing?.code ?? '',
    name: form.name.trim(),
    description: form.description ?? '',
    amount: Math.round(form.amount),
    total_amount: total,
    items_count: form.details.length,
    has_details: hasDetails ? 1 : 0,
    category_id: form.category_id ?? null,
    type_id: form.type_id ?? null,
    payment_method: form.payment_method,
    status: form.status,
    date: form.date,
    time: form.time,
    notes: form.notes,
    voided_at: existing?.voided_at ?? null,
    receipt_url: existing?.receipt_url ?? null,
    receipt_thumb_url: existing?.receipt_thumb_url ?? null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    workspace_id: wsId,
  };

  if (!row.code) {
    row.code = await nextCodeFor(db, 'expenses', 'GAS');
  }

  const details: ExpenseDetail[] = form.details.map((d, idx) => ({
    id: `${id}-${idx}`,
    expense_id: id,
    product_name: d.product_name,
    quantity: d.quantity,
    unit_price: Math.round(d.unit_price),
    subtotal: Math.round(d.quantity * d.unit_price),
  }));

  await db.withExclusiveTransactionAsync(async (txn) => {
    await writeTx(txn as unknown as DbLike, {
      table: 'expenses',
      entityType: 'expense',
      operation: existing ? 'UPDATE' : 'INSERT',
      row: { ...(row as unknown as Record<string, unknown>), items: details as unknown as Record<string, unknown>[] },
      before: existing,
      includeChildren: async (t) => {
        await t.runAsync('DELETE FROM expense_details WHERE expense_id = ?', id);
        for (const d of details) {
          await upsert(t, 'expense_details', d as unknown as Record<string, unknown>);
        }
      },
    });
  });

  return { ...row, details };
}

export async function deleteExpense(id: string): Promise<void> {
  const db = await getDb();
  await softDelete(db, 'expenses', 'expense', id);
}

/**
 * Anula un gasto: marca status='cancelado' y registra voided_at.
 * No elimina físicamente el registro (las operaciones históricas se conservan).
 */
export async function voidExpense(id: string): Promise<boolean> {
  const db = await getDb();
  const existing = await getExpense(id);
  if (!existing || existing.status === 'cancelado') return false;

  const now = nowIso();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `UPDATE expenses SET status = 'cancelado', voided_at = ?, updated_at = ?, sync_status = 'pending'
       WHERE id = ?`,
      now, now, id
    );
    await enqueueOutbox(txn as unknown as DbLike, {
      entity_type: 'expense',
      entity_id: id,
      operation: 'UPDATE',
      payload: { id, status: 'cancelado', voided_at: now, updated_at: now },
    });
    await enqueueAudit(txn as unknown as DbLike, {
      action: 'void',
      entity_type: 'expense',
      entity_id: id,
      before: existing,
      after: { ...existing, status: 'cancelado', voided_at: now, updated_at: now },
    });
  });
  return true;
}

export interface ExpenseSummary {
  total: number;
  count: number;
  paid: number;
  pending: number;
  voided: number;
  by_category: { category: string; total: number; count: number }[];
  by_payment: { method: string; total: number; count: number }[];
}

export async function expensesSummary(filters: ExpenseFilters = {}): Promise<ExpenseSummary> {
  const db = await getDb();
  const wsId = await requireActiveWorkspaceId();
  const conditions = ['e.deleted = 0', 'e.workspace_id = ?'];
  const params: SQLiteBindValue[] = [wsId];

  if (filters.categoryId) {
    conditions.push('e.category_id = ?');
    params.push(filters.categoryId);
  }
  if (filters.paymentMethod) {
    conditions.push('e.payment_method = ?');
    params.push(filters.paymentMethod);
  }
  if (filters.dateFrom) {
    conditions.push('e.date >= ?');
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push('e.date <= ?');
    params.push(filters.dateTo);
  }
  const where = conditions.join(' AND ');

  const totals = await db.getFirstAsync<{ total: number; count: number; paid: number; pending: number; voided: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN status != 'cancelado' THEN total_amount END), 0) as total,
       COUNT(*) as count,
       COALESCE(SUM(CASE WHEN status = 'pagado' THEN 1 END), 0) as paid,
       COALESCE(SUM(CASE WHEN status = 'pendiente' THEN 1 END), 0) as pending,
       COALESCE(SUM(CASE WHEN status = 'cancelado' THEN 1 END), 0) as voided
     FROM expenses e
     WHERE ${where}`,
    ...params
  );

  const by_category = await db.getAllAsync<{ category: string; total: number; count: number }>(
    `SELECT COALESCE(c.name, 'Sin categoría') as category, SUM(e.total_amount) as total, COUNT(*) as count
     FROM expenses e LEFT JOIN categories c ON c.id = e.category_id
     WHERE ${where} AND e.status != 'cancelado'
     GROUP BY e.category_id ORDER BY total DESC`,
    ...params
  );

  const by_payment = await db.getAllAsync<{ method: string; total: number; count: number }>(
    `SELECT e.payment_method as method, SUM(e.total_amount) as total, COUNT(*) as count
     FROM expenses e
     WHERE ${where} AND e.status != 'cancelado'
     GROUP BY e.payment_method ORDER BY total DESC`,
    ...params
  );

  return {
    total: totals?.total ?? 0,
    count: totals?.count ?? 0,
    paid: totals?.paid ?? 0,
    pending: totals?.pending ?? 0,
    voided: totals?.voided ?? 0,
    by_category,
    by_payment,
  };
}

export async function expensesByCategory(): Promise<{ category: string; total: number }[]> {
  const db = await getDb();
  const wsId = await requireActiveWorkspaceId();
  return db.getAllAsync<{ category: string; total: number }>(
    `SELECT COALESCE(c.name, 'Sin categoría') as category, SUM(e.total_amount) as total
     FROM expenses e LEFT JOIN categories c ON c.id = e.category_id
     WHERE e.deleted = 0 AND e.workspace_id = ? GROUP BY e.category_id ORDER BY total DESC`,
    wsId
  );
}

export const defaultExpenseForm = (): ExpenseForm => ({
  name: '',
  description: '',
  amount: 0,
  category_id: null,
  type_id: null,
  payment_method: 'efectivo',
  status: 'activo',
  date: new Date().toISOString().slice(0, 10),
  time: new Date().toTimeString().slice(0, 8),
  notes: '',
  details: [],
});
