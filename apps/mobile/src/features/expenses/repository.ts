import { getDb } from '../../core/db/database';
import { nextCodeFor, softDelete, upsert, writeTx, type DbLike } from '../../core/db/repo';
import type { Expense, ExpenseDetail } from '../../core/domain/types';
import { newId, nowIso } from '../../core/utils/id';

export async function listExpenses(): Promise<Expense[]> {
  const db = await getDb();
  return db.getAllAsync<Expense>(
    `SELECT e.*, c.name as category_name, t.name as type_name
     FROM expenses e
     LEFT JOIN categories c ON c.id = e.category_id
     LEFT JOIN expense_types t ON t.id = e.type_id
     WHERE e.deleted = 0 ORDER BY e.date DESC, e.created_at DESC`
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
    created_at: existing?.created_at ?? now,
    updated_at: now,
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

export async function expensesByCategory(): Promise<{ category: string; total: number }[]> {
  const db = await getDb();
  return db.getAllAsync<{ category: string; total: number }>(
    `SELECT COALESCE(c.name, 'Sin categoría') as category, SUM(e.total_amount) as total
     FROM expenses e LEFT JOIN categories c ON c.id = e.category_id
     WHERE e.deleted = 0 GROUP BY e.category_id ORDER BY total DESC`
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
