import type {
  Garment,
  Size,
  Color,
  Material,
  ProductionOrder,
  ProductionMaterial,
  ProductionStatus,
} from "@/types/modules";

export const PRODUCTION_STATUSES = [
  "pendiente",
  "en_proceso",
  "completada",
  "anulada",
] as const satisfies readonly ProductionStatus[];

export const MATERIAL_UNITS = [
  "metro",
  "yarda",
  "kilogramo",
  "gramo",
  "pieza",
  "rollo",
  "botella",
  "caja",
] as const;

export type MaterialUnit = (typeof MATERIAL_UNITS)[number];

export function buildGarment(input: {
  data: {
    name: string;
    description: string;
    categoryId: string;
    salePrice: number;
    notes: string;
  };
  code: string;
  now: string;
}): Garment {
  return {
    id: crypto.randomUUID(),
    code: input.code,
    name: input.data.name.trim(),
    description: input.data.description.trim(),
    categoryId: input.data.categoryId,
    salePrice: input.data.salePrice,
    notes: input.data.notes || "",
    createdAt: input.now,
    updatedAt: input.now,
    deleted: false,
    syncStatus: "pending",
    workspaceId: "",
  };
}

export function buildSize(input: {
  data: { name: string; sortOrder: number };
  now: string;
}): Size {
  return {
    id: crypto.randomUUID(),
    name: input.data.name.trim(),
    sortOrder: input.data.sortOrder,
    createdAt: input.now,
    updatedAt: input.now,
    deleted: false,
    syncStatus: "pending",
    workspaceId: "",
  };
}

export function buildColor(input: {
  data: { name: string; hex: string };
  now: string;
}): Color {
  return {
    id: crypto.randomUUID(),
    name: input.data.name.trim(),
    hex: input.data.hex,
    createdAt: input.now,
    updatedAt: input.now,
    deleted: false,
    syncStatus: "pending",
    workspaceId: "",
  };
}

export function buildMaterial(input: {
  data: {
    name: string;
    unit: string;
    costPerUnit: number;
    stock: number;
    notes: string;
  };
  code: string;
  now: string;
}): Material {
  return {
    id: crypto.randomUUID(),
    code: input.code,
    name: input.data.name.trim(),
    unit: input.data.unit,
    costPerUnit: input.data.costPerUnit,
    stock: input.data.stock,
    notes: input.data.notes || "",
    createdAt: input.now,
    updatedAt: input.now,
    deleted: false,
    syncStatus: "pending",
    workspaceId: "",
  };
}

export function buildProductionOrder(input: {
  data: {
    garmentId: string;
    garmentName: string;
    sizeId: string;
    sizeName: string;
    colorId: string;
    colorName: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    startDate: string;
    dueDate: string;
    notes: string;
  };
  code: string;
  now: string;
}): ProductionOrder {
  return {
    id: crypto.randomUUID(),
    code: input.code,
    garmentId: input.data.garmentId,
    garmentName: input.data.garmentName,
    sizeId: input.data.sizeId,
    sizeName: input.data.sizeName,
    colorId: input.data.colorId,
    colorName: input.data.colorName,
    quantity: input.data.quantity,
    unitCost: input.data.unitCost,
    totalCost: input.data.totalCost,
    status: "pendiente",
    startDate: input.data.startDate,
    dueDate: input.data.dueDate,
    completedAt: null,
    notes: input.data.notes || "",
    voidedAt: null,
    createdAt: input.now,
    updatedAt: input.now,
    deleted: false,
    syncStatus: "pending",
    workspaceId: "",
  };
}

export function buildProductionMaterial(input: {
  data: {
    productionOrderId: string;
    materialId: string;
    materialName: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
  };
  now: string;
}): ProductionMaterial {
  return {
    id: crypto.randomUUID(),
    productionOrderId: input.data.productionOrderId,
    materialId: input.data.materialId,
    materialName: input.data.materialName,
    quantity: input.data.quantity,
    unitCost: input.data.unitCost,
    totalCost: input.data.totalCost,
    createdAt: input.now,
    syncStatus: "pending",
    workspaceId: "",
  };
}

export function canEditGarment(_garment: Pick<Garment, "deleted">): boolean {
  return !_garment.deleted;
}

export function canVoidProduction(order: Pick<ProductionOrder, "status" | "deleted">): boolean {
  return !order.deleted && order.status !== "anulada";
}

export function computeProductionTotal(
  quantity: number,
  unitCost: number
): number {
  return Math.round(quantity * unitCost * 100) / 100;
}

export function computeMaterialTotal(
  quantity: number,
  unitCost: number
): number {
  return Math.round(quantity * unitCost * 100) / 100;
}

export interface FilterableProductionOrder {
  id: string;
  code: string;
  garmentName: string;
  status: string;
  deleted?: boolean;
}

export interface ProductionOrderFilters {
  search?: string;
  status?: string;
}

export function filterProductionOrders<T extends FilterableProductionOrder>(
  orders: T[],
  filters: ProductionOrderFilters = {}
): T[] {
  const search = (filters.search || "").trim().toLowerCase();

  return orders.filter((order) => {
    if (order.deleted === true) return false;
    if (filters.status && order.status !== filters.status) return false;

    if (search) {
      const haystack = [order.code, order.garmentName, order.status]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });
}
