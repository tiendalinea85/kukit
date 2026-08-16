import type { InventoryMovement, InventoryMovementType } from "@/types";

// El stock NO se guarda en el producto: se deriva siempre de la suma de
// movimientos (entradas - salidas). "No modificar directamente el stock".
// `ajuste` lleva cantidad firmada: positivo agrega stock, negativo lo descuenta.

export interface MovementLike {
  productId: string;
  type: InventoryMovementType;
  quantity: number;
}

export function stockDelta(m: Pick<InventoryMovement, "type" | "quantity">): number {
  switch (m.type) {
    case "salida":
      return -m.quantity;
    case "ajuste":
      return m.quantity;
    case "entrada":
      return m.quantity;
  }
}

export function computeStock(movements: Pick<InventoryMovement, "type" | "quantity">[]): number {
  return movements.reduce((sum, m) => sum + stockDelta(m), 0);
}

export function computeStockById(movements: MovementLike[]): Record<string, number> {
  const byId: Record<string, number> = {};
  for (const m of movements) {
    byId[m.productId] = (byId[m.productId] ?? 0) + stockDelta(m);
  }
  return byId;
}

export interface StockRequirement {
  productId: string;
  label: string;
  quantity: number;
}

export interface MissingStock {
  productId: string;
  label: string;
  required: number;
  available: number;
}

export function missingStock(
  requirements: StockRequirement[],
  stockById: Record<string, number>,
): MissingStock[] {
  const missing: MissingStock[] = [];
  for (const r of requirements) {
    const available = stockById[r.productId] ?? 0;
    if (r.quantity > available) {
      missing.push({ productId: r.productId, label: r.label, required: r.quantity, available });
    }
  }
  return missing;
}
