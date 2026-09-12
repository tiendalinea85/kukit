import { getDb } from '../../core/db/database';
import { nextCodeFor, softDelete, writeWithOutbox } from '../../core/db/repo';
import type { Investment, InvestmentType, InvestmentStatus, PaymentMethod } from '../../core/domain/types';
import { newId, nowIso } from '../../core/utils/id';
import { requireActiveWorkspaceId } from '../../core/workspace/isolation';

export async function listInvestments(): Promise<Investment[]> {
  const db = await getDb();
  const wsId = await requireActiveWorkspaceId();
  return db.getAllAsync<Investment>(
    `SELECT * FROM investments WHERE deleted = 0 AND workspace_id = ? ORDER BY date DESC, created_at DESC`,
    wsId
  );
}

export async function getInvestment(id: string): Promise<Investment | null> {
  const db = await getDb();
  return db.getFirstAsync<Investment>('SELECT * FROM investments WHERE id = ?', id);
}

export interface InvestmentForm {
  id?: string;
  asset_name: string;
  asset_type: InvestmentType;
  amount: number;
  current_value: number;
  category: string;
  supplier: string;
  payment_method: PaymentMethod;
  status: InvestmentStatus;
  date: string;
  notes: string;
}

export async function saveInvestment(form: InvestmentForm): Promise<Investment> {
  const db = await getDb();
  const wsId = await requireActiveWorkspaceId();
  const existing = form.id ? await getInvestment(form.id) : null;

  const now = nowIso();
  const amount = Math.round(form.amount);
  const currentValue = Math.round(form.current_value);
  const row: Investment = {
    id: form.id ?? newId(),
    code: existing?.code ?? '',
    asset_name: form.asset_name.trim(),
    asset_type: form.asset_type,
    amount,
    current_value: currentValue,
    return_rate: amount > 0 ? ((currentValue - amount) / amount) * 100 : 0,
    category: form.category,
    supplier: form.supplier.trim(),
    payment_method: form.payment_method,
    status: form.status,
    voided_at: existing?.voided_at ?? null,
    date: form.date,
    notes: form.notes,
    workspace_id: wsId,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };

  if (!row.code) {
    row.code = await nextCodeFor(db, 'investments', 'INV');
  }

  await writeWithOutbox(db, {
    table: 'investments',
    entityType: 'investment',
    operation: existing ? 'UPDATE' : 'INSERT',
    row: row as unknown as Record<string, unknown>,
    before: existing,
  });

  return row;
}

export async function deleteInvestment(id: string): Promise<void> {
  const db = await getDb();
  await softDelete(db, 'investments', 'investment', id);
}

export async function investmentSummary(): Promise<{ total_invested: number; total_value: number; count: number }> {
  const db = await getDb();
  const wsId = await requireActiveWorkspaceId();
  const row = await db.getFirstAsync<{ total_invested: number; total_value: number; count: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total_invested,
            COALESCE(SUM(current_value), 0) as total_value,
            COUNT(*) as count
     FROM investments WHERE deleted = 0 AND workspace_id = ?`,
    wsId
  );
  return row ?? { total_invested: 0, total_value: 0, count: 0 };
}

export const defaultInvestmentForm = (): InvestmentForm => ({
  asset_name: '',
  asset_type: 'activo',
  amount: 0,
  current_value: 0,
  category: '',
  supplier: '',
  payment_method: 'efectivo',
  status: 'pagado',
  date: new Date().toISOString().slice(0, 10),
  notes: '',
});
