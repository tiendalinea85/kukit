import { db } from "@/lib/db";
import { computeStock } from "../domain/stockRules";
import type { InventoryMovement, Product } from "@/types";
import type { ProductFormData, ProductWithStockFormData } from "../schemas/productSchema";

function now(): string {
  return new Date().toISOString();
}

export interface ProductWithStock extends Product {
  stock: number;
}

export async function getStockById(): Promise<Record<string, number>> {
  const movements = await db.inventoryMovements.toArray();
  const byId: Record<string, number> = {};
  for (const m of movements) {
    byId[m.productId] = (byId[m.productId] ?? 0) + (m.type === "entrada" ? m.quantity : -m.quantity);
  }
  return byId;
}

export async function getProductStock(productId: string): Promise<number> {
  const movements = await db.inventoryMovements.where("productId").equals(productId).toArray();
  return computeStock(movements);
}

export async function listProductsWithStock(): Promise<ProductWithStock[]> {
  const [products, stockById] = await Promise.all([db.products.toArray(), getStockById()]);
  return products
    .filter((p) => !p.deleted)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({ ...p, stock: stockById[p.id] ?? 0 }));
}

export async function createProduct(data: ProductWithStockFormData): Promise<Product> {
  const t = now();
  const product: Product = {
    id: crypto.randomUUID(),
    code: data.code.trim(),
    name: data.name.trim(),
    color: data.color?.trim() ?? "",
    categoryId: data.categoryId?.trim() ?? "",
    createdAt: t,
    updatedAt: t,
    deleted: false,
    syncStatus: "pending",
  };

  // El stock inicial no se guarda en el producto: se registra como movimiento
  // de ENTRADA. El stock siempre se deriva de los movimientos.
  await db.transaction("rw", db.products, db.inventoryMovements, async () => {
    await db.products.add(product);
    if ((data.initialStock ?? 0) > 0) {
      const movement: InventoryMovement = {
        id: crypto.randomUUID(),
        productId: product.id,
        type: "entrada",
        quantity: data.initialStock as number,
        referenceType: "inventario_inicial",
        referenceId: product.id,
        notes: `Stock inicial ${product.name}`,
        createdAt: t,
        syncStatus: "pending",
      };
      await db.inventoryMovements.add(movement);
    }
  });

  return product;
}

export async function updateProduct(id: string, data: ProductFormData): Promise<void> {
  const existing = await db.products.get(id);
  if (!existing) throw new Error("Producto no encontrado");

  await db.products.update(id, {
    code: data.code.trim(),
    name: data.name.trim(),
    color: data.color?.trim() ?? "",
    categoryId: data.categoryId?.trim() ?? "",
    updatedAt: now(),
    syncStatus: "pending" as const,
  });
}

export async function deleteProduct(id: string): Promise<void> {
  await db.products.update(id, {
    deleted: true,
    updatedAt: now(),
    syncStatus: "pending" as const,
  });
}

export async function addStockMovement(input: {
  productId: string;
  type: "entrada" | "salida" | "ajuste";
  quantity: number;
  referenceType: InventoryMovement["referenceType"];
  referenceId: string;
  notes: string;
}): Promise<InventoryMovement> {
  const movement: InventoryMovement = {
    id: crypto.randomUUID(),
    productId: input.productId,
    type: input.type,
    quantity: input.quantity,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    notes: input.notes,
    createdAt: now(),
    syncStatus: "pending",
  };
  await db.inventoryMovements.add(movement);
  return movement;
}

// Ajuste de stock por conteo físico u obsolescencia. `delta` es firmado:
// positivo agrega unidades, negativo las descuenta. Siempre append-only.
export async function adjustStock(input: {
  productId: string;
  delta: number;
  notes: string;
}): Promise<InventoryMovement> {
  if (!Number.isFinite(input.delta) || input.delta === 0) {
    throw new Error("El ajuste debe ser distinto de cero");
  }
  return addStockMovement({
    productId: input.productId,
    type: "ajuste",
    quantity: input.delta,
    referenceType: "ajuste",
    referenceId: input.productId,
    notes: input.notes,
  });
}
