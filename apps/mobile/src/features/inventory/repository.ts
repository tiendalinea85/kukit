import { getDb } from '../../core/db/database';
import { enqueueAudit, enqueueOutbox } from '../../core/db/outbox';
import { upsert, type DbLike } from '../../core/db/repo';
import type { MovementReference, MovementType, StockMovement } from '../../core/domain/types';
import { newId, nowIso } from '../../core/utils/id';

export async function listMovements(productId?: string): Promise<StockMovement[]> {
  const db = await getDb();
  const where = productId ? 'WHERE product_id = ?' : '';
  const params = productId ? [productId] : [];
  return db.getAllAsync<StockMovement>(
    `SELECT * FROM stock_movements ${where} ORDER BY date DESC, created_at DESC LIMIT 200`,
    ...params
  );
}

export async function listLowStock(threshold: number = 5): Promise<{ product: string; stock: number; min: number }[]> {
  const db = await getDb();
  return db.getAllAsync<{ product: string; stock: number; min: number }>(
    `SELECT name as product, stock, min_stock as min
     FROM products WHERE deleted = 0 AND active = 1 AND stock <= min_stock
     ORDER BY stock ASC`
  );
}

export interface MovementInput {
  product_id: string;
  movement_type: MovementType;
  quantity: number;
  reference_type?: MovementReference | null;
  reference_id?: string | null;
  date?: string;
  notes?: string;
}

export async function applyStockMovement(
  db: DbLike,
  input: MovementInput,
  _now?: string
): Promise<void> {
  const now = _now ?? nowIso();
  const id = newId();
  const qty = Math.abs(input.quantity);

  const product = await db.getFirstAsync<{ stock: number; name: string }>(
    'SELECT stock, name FROM products WHERE id = ?',
    input.product_id
  );
  if (!product) return;

  let newStock = product.stock;
  if (input.movement_type === 'entrada') newStock = product.stock + qty;
  else if (input.movement_type === 'salida') newStock = Math.max(0, product.stock - qty);
  else if (input.movement_type === 'ajuste') newStock = qty;
  else newStock = Math.max(0, product.stock - qty);

  const movement: StockMovement = {
    id,
    product_id: input.product_id,
    movement_type: input.movement_type,
    quantity: qty,
    reference_type: input.reference_type ?? null,
    reference_id: input.reference_id ?? null,
    date: input.date ?? now.slice(0, 10),
    notes: input.notes ?? '',
    created_at: now,
  };

  await upsert(db, 'stock_movements', movement as unknown as Record<string, unknown>);
  await db.runAsync('UPDATE products SET stock = ?, updated_at = ? WHERE id = ?', newStock, now, input.product_id);

  await enqueueOutbox(db, {
    entity_type: 'stock_movement',
    entity_id: id,
    operation: 'INSERT',
    payload: movement as unknown as Record<string, unknown>,
  });
  await enqueueAudit(db, {
    action: `stock:${input.movement_type}`,
    entity_type: 'stock_movement',
    entity_id: id,
    after: movement,
  });
}

export async function registerMovement(input: MovementInput): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await applyStockMovement(txn as unknown as DbLike, input);
  });
}

export function movementDelta(type: MovementType): number {
  if (type === 'entrada') return 1;
  if (type === 'salida' || type === 'transferencia') return -1;
  return 0;
}
