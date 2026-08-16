import { getDb } from '../../core/db/database';
import { nextCodeFor, softDelete, upsert, writeTx, type DbLike } from '../../core/db/repo';
import type { Purchase, PurchaseItem } from '../../core/domain/types';
import { newId, nowIso } from '../../core/utils/id';
import { applyStockMovement } from '../inventory/repository';

export async function listPurchases(): Promise<Purchase[]> {
  const db = await getDb();
  return db.getAllAsync<Purchase>(
    `SELECT * FROM purchases WHERE deleted = 0 ORDER BY date DESC, created_at DESC`
  );
}

export async function getPurchase(id: string): Promise<Purchase | null> {
  const db = await getDb();
  const purchase = await db.getFirstAsync<Purchase>('SELECT * FROM purchases WHERE id = ?', id);
  if (!purchase) return null;
  purchase.items = await db.getAllAsync<PurchaseItem>(
    'SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY id',
    id
  );
  return purchase;
}

export interface PurchaseForm {
  id?: string;
  supplier: string;
  date: string;
  time: string;
  status: Purchase['status'];
  notes: string;
  items: Omit<PurchaseItem, 'id' | 'purchase_id' | 'subtotal'>[];
}

export async function savePurchase(form: PurchaseForm): Promise<Purchase> {
  const db = await getDb();
  const existing = form.id ? await getPurchase(form.id) : null;

  const total = form.items.reduce((acc, i) => acc + Math.round(i.quantity * i.unit_price), 0);

  const now = nowIso();
  const id = form.id ?? newId();
  const row: Purchase = {
    id,
    code: existing?.code ?? '',
    supplier: form.supplier.trim(),
    date: form.date,
    time: form.time,
    status: form.status,
    total_amount: total,
    items_count: form.items.length,
    notes: form.notes,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };

  if (!row.code) {
    row.code = await nextCodeFor(db, 'purchases', 'COM');
  }

  const items: PurchaseItem[] = form.items.map((i, idx) => ({
    id: `${id}-${idx}`,
    purchase_id: id,
    product_id: i.product_id ?? null,
    product_name: i.product_name,
    quantity: i.quantity,
    unit_price: Math.round(i.unit_price),
    subtotal: Math.round(i.quantity * i.unit_price),
  }));

  const transitioningToReceived = form.status === 'recibida' && existing?.status !== 'recibida';

  await db.withExclusiveTransactionAsync(async (txn) => {
    await writeTx(txn as unknown as DbLike, {
      table: 'purchases',
      entityType: 'purchase',
      operation: existing ? 'UPDATE' : 'INSERT',
      row: { ...(row as unknown as Record<string, unknown>), items: items as unknown as Record<string, unknown>[] },
      before: existing,
      includeChildren: async (t) => {
        await t.runAsync('DELETE FROM purchase_items WHERE purchase_id = ?', id);
        for (const item of items) {
          await upsert(t, 'purchase_items', item as unknown as Record<string, unknown>);
        }
        if (transitioningToReceived) {
          for (const item of items) {
            if (!item.product_id) continue;
            await applyStockMovement(
              t,
              {
                product_id: item.product_id,
                movement_type: 'entrada',
                quantity: item.quantity,
                reference_type: 'purchase',
                reference_id: id,
                notes: `Compra ${row.code}`,
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

export async function deletePurchase(id: string): Promise<void> {
  const db = await getDb();
  await softDelete(db, 'purchases', 'purchase', id);
}

export const defaultPurchaseForm = (): PurchaseForm => ({
  supplier: '',
  date: new Date().toISOString().slice(0, 10),
  time: new Date().toTimeString().slice(0, 8),
  status: 'recibida',
  notes: '',
  items: [],
});
