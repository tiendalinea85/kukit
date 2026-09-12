import { getDb } from '../../core/db/database';
import { nextCodeFor, softDelete, upsert, writeTx, type DbLike } from '../../core/db/repo';
import type { Sale, SaleItem } from '../../core/domain/types';
import { newId, nowIso } from '../../core/utils/id';
import { applyStockMovement } from '../inventory/repository';
import { requireActiveWorkspaceId } from '../../core/workspace/isolation';

export async function listSales(): Promise<Sale[]> {
  const db = await getDb();
  const wsId = await requireActiveWorkspaceId();
  return db.getAllAsync<Sale>(
    `SELECT s.*, c.name as client_name
     FROM sales s LEFT JOIN clients c ON c.id = s.client_id
     WHERE s.deleted = 0 AND s.workspace_id = ? ORDER BY s.date DESC, s.created_at DESC`,
    wsId
  );
}

export async function getSale(id: string): Promise<Sale | null> {
  const db = await getDb();
  const sale = await db.getFirstAsync<Sale>('SELECT * FROM sales WHERE id = ?', id);
  if (!sale) return null;
  sale.items = await db.getAllAsync<SaleItem>('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id', id);
  return sale;
}

export interface SaleForm {
  id?: string;
  client_id: string | null;
  date: string;
  time: string;
  status: Sale['status'];
  payment_method: Sale['payment_method'];
  tax_rate: number;
  notes: string;
  items: Omit<SaleItem, 'id' | 'sale_id' | 'subtotal'>[];
}

export async function saveSale(form: SaleForm): Promise<Sale> {
  const db = await getDb();
  const wsId = await requireActiveWorkspaceId();
  const existing = form.id ? await getSale(form.id) : null;

  const items: SaleItem[] = form.items.map((i, idx) => ({
    id: `${form.id ?? newId()}-${idx}`,
    sale_id: form.id ?? newId(),
    product_id: i.product_id ?? null,
    product_name: i.product_name,
    quantity: i.quantity,
    unit_price: Math.round(i.unit_price),
    discount: Math.round(i.discount ?? 0),
    subtotal: Math.round(i.quantity * i.unit_price),
  }));

  const id = items[0]?.sale_id ?? newId();
  items.forEach((it) => (it.sale_id = id));
  items.forEach((it, idx) => (it.id = `${id}-${idx}`));

  const subtotal = items.reduce((acc, i) => acc + i.subtotal, 0);
  const discount = items.reduce((acc, i) => acc + i.discount, 0);
  const tax = Math.round(((subtotal - discount) * (form.tax_rate ?? 0)) / 100);
  const total = subtotal - discount + tax;

  const now = nowIso();
  const row: Sale = {
    id,
    code: existing?.code ?? '',
    client_id: form.client_id ?? null,
    date: form.date,
    time: form.time,
    status: form.status,
    subtotal,
    discount,
    tax,
    total_amount: total,
    items_count: items.length,
    payment_method: form.payment_method,
    notes: form.notes,
    workspace_id: wsId,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };

  if (!row.code) {
    row.code = await nextCodeFor(db, 'sales', 'VEN');
  }

  const transitioningToCompleted = form.status === 'completada' && existing?.status !== 'completada';

  await db.withExclusiveTransactionAsync(async (txn) => {
    await writeTx(txn as unknown as DbLike, {
      table: 'sales',
      entityType: 'sale',
      operation: existing ? 'UPDATE' : 'INSERT',
      row: { ...(row as unknown as Record<string, unknown>), items: items as unknown as Record<string, unknown>[] },
      before: existing,
      includeChildren: async (t) => {
        await t.runAsync('DELETE FROM sale_items WHERE sale_id = ?', id);
        for (const item of items) {
          await upsert(t, 'sale_items', item as unknown as Record<string, unknown>);
        }
        if (transitioningToCompleted) {
          for (const item of items) {
            if (!item.product_id) continue;
            await applyStockMovement(
              t,
              {
                product_id: item.product_id,
                movement_type: 'salida',
                quantity: item.quantity,
                reference_type: 'sale',
                reference_id: id,
                notes: `Venta ${row.code}`,
                workspace_id: wsId,
              },
              now
            );
          }
        }
      },
    });
  });

  return { ...row, items };
}

export async function deleteSale(id: string): Promise<void> {
  const db = await getDb();
  await softDelete(db, 'sales', 'sale', id);
}

export const defaultSaleForm = (): SaleForm => ({
  client_id: null,
  date: new Date().toISOString().slice(0, 10),
  time: new Date().toTimeString().slice(0, 8),
  status: 'completada',
  payment_method: 'efectivo',
  tax_rate: 0,
  notes: '',
  items: [],
});
