import { getDb } from '../../core/db/database';
import { nextCodeFor, softDelete, writeWithOutbox } from '../../core/db/repo';
import type { Category, Product } from '../../core/domain/types';
import { nowIso, newId, todayDate } from '../../core/utils/id';
import { requireActiveWorkspaceId } from '../../core/workspace/isolation';

export async function listProducts(): Promise<Product[]> {
  const db = await getDb();
  const wsId = await requireActiveWorkspaceId();
  return db.getAllAsync<Product>(
    `SELECT p.*, c.name as category_name
     FROM products p LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.deleted = 0 AND p.workspace_id = ? ORDER BY p.name COLLATE NOCASE`,
    wsId
  );
}

export async function getProduct(id: string): Promise<Product | null> {
  const db = await getDb();
  return db.getFirstAsync<Product>('SELECT * FROM products WHERE id = ?', id);
}

export async function saveProduct(input: Omit<Product, 'id' | 'code' | 'created_at' | 'updated_at'> & { id?: string }): Promise<Product> {
  const db = await getDb();
  const wsId = await requireActiveWorkspaceId();
  const existing = input.id ? await getProduct(input.id) : null;
  const row: Product = {
    id: input.id ?? newId(),
    code: existing?.code ?? '',
    name: input.name.trim(),
    description: input.description ?? '',
    sku: input.sku ?? '',
    category_id: input.category_id ?? null,
    cost_price: Math.round(input.cost_price),
    sale_price: Math.round(input.sale_price),
    unit: input.unit ?? 'unidad',
    tax_rate: input.tax_rate ?? 0,
    stock: existing?.stock ?? input.stock ?? 0,
    min_stock: input.min_stock ?? 0,
    active: input.active ?? 1,
    workspace_id: wsId,
    created_at: existing?.created_at ?? nowIso(),
    updated_at: nowIso(),
  };

  if (!row.code) {
    row.code = await nextCodeFor(db, 'products', 'PRD');
  }

  await writeWithOutbox(db, {
    table: 'products',
    entityType: 'product',
    operation: existing ? 'UPDATE' : 'INSERT',
    row: row as unknown as Record<string, unknown>,
    before: existing,
  });

  return row;
}

export async function deleteProduct(id: string): Promise<void> {
  const db = await getDb();
  await softDelete(db, 'products', 'product', id);
}

export async function listCategories(): Promise<Category[]> {
  const db = await getDb();
  const wsId = await requireActiveWorkspaceId();
  return db.getAllAsync<Category>(
    `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.deleted = 0 AND p.workspace_id = ?) as product_count
     FROM categories c WHERE c.deleted = 0 ORDER BY c.name COLLATE NOCASE`,
    wsId
  );
}

export async function getCategory(id: string): Promise<Category | null> {
  const db = await getDb();
  return db.getFirstAsync<Category>('SELECT * FROM categories WHERE id = ?', id);
}

export async function saveCategory(input: { id?: string; name: string; color?: string; icon?: string }): Promise<Category> {
  const db = await getDb();
  const wsId = await requireActiveWorkspaceId();
  const existing = input.id ? await getCategory(input.id) : null;
  const row: Category = {
    id: input.id ?? newId(),
    name: input.name.trim(),
    color: input.color ?? '#8b5cf6',
    icon: input.icon ?? '📦',
    workspace_id: wsId,
    created_at: existing?.created_at ?? nowIso(),
    updated_at: nowIso(),
  };

  await writeWithOutbox(db, {
    table: 'categories',
    entityType: 'category',
    operation: existing ? 'UPDATE' : 'INSERT',
    row: row as unknown as Record<string, unknown>,
    before: existing,
  });

  return row;
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await getDb();
  await softDelete(db, 'categories', 'category', id);
}

export async function listExpenseTypes(): Promise<{ id: string; name: string }[]> {
  const db = await getDb();
  const wsId = await requireActiveWorkspaceId();
  return db.getAllAsync<{ id: string; name: string }>(
    'SELECT * FROM expense_types WHERE workspace_id = ? ORDER BY name COLLATE NOCASE',
    wsId
  );
}

export async function saveExpenseType(name: string): Promise<{ id: string; name: string }> {
  const db = await getDb();
  const wsId = await requireActiveWorkspaceId();
  const row = { id: newId(), name: name.trim(), workspace_id: wsId, created_at: nowIso(), updated_at: nowIso() };
  await writeWithOutbox(db, {
    table: 'expense_types',
    entityType: 'expense_type',
    operation: 'INSERT',
    row: row as unknown as Record<string, unknown>,
  });
  return row;
}

export const defaultProductForm = (): Omit<Product, 'id' | 'code' | 'created_at' | 'updated_at'> & { id?: string } => ({
  name: '',
  description: '',
  sku: '',
  category_id: null,
  cost_price: 0,
  sale_price: 0,
  unit: 'unidad',
  tax_rate: 0,
  stock: 0,
  min_stock: 0,
  active: 1,
});

export const defaultCategoryForm = { name: '', color: '#8b5cf6', icon: '📦' };

export function today(): string {
  return todayDate();
}
