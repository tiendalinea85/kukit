import { db } from "@/lib/db";
import { buildSale, buildSaleDetail, canEditSale, computeSaleTotal, isConfirmed } from "../domain/saleRules";
import { missingStock, computeStockById } from "../domain/stockRules";
import { generateSaleCode } from "@/utils/code";
import type { InventoryMovement, Sale } from "@/types";
import type { SaleFormData } from "../schemas/saleSchema";
import type { SaleDetailInput } from "../domain/saleRules";

function now(): string {
  return new Date().toISOString();
}

export interface SaleData {
  header: SaleFormData;
  details: SaleDetailInput[];
}

export async function createSale(data: SaleData, options?: { confirm?: boolean }): Promise<Sale> {
  const code = await generateSaleCode();
  const sale = buildSale(
    {
      customerId: data.header.customerId,
      date: data.header.date,
      paymentMethod: data.header.paymentMethod,
      notes: data.header.notes ?? "",
      status: options?.confirm ? "confirmada" : "pendiente",
      details: data.details,
    },
    code,
    now(),
  );

  await db.transaction("rw", db.sales, db.saleDetails, db.inventoryMovements, async () => {
    await db.sales.add(sale);
    await db.saleDetails.bulkAdd(
      data.details.map((d) => buildSaleDetail(d, sale.id, sale.createdAt)),
    );
    if (options?.confirm) {
      await applyOutboundMovements(sale);
    }
  });

  return sale;
}

// Confirmar: pendiente -> confirmada. Genera movimientos SALIDA de inventario.
export async function confirmSale(id: string): Promise<Sale> {
  const sale = await db.sales.get(id);
  if (!sale) throw new Error("Venta no encontrada");
  if (sale.status !== "pendiente") throw new Error("Solo se pueden confirmar ventas pendientes");

  const details = await db.saleDetails.where("saleId").equals(id).toArray();
  if (details.length === 0) throw new Error("La venta no tiene detalle de productos");

  const movements = await db.inventoryMovements.toArray();
  const stockById = computeStockById(movements);
  const missing = missingStock(
    details.map((d) => ({ productId: d.productId, label: d.code, quantity: d.quantity })),
    stockById,
  );
  if (missing.length > 0) {
    const labels = missing.map((m) => `${m.label} (falta ${m.available}/${m.required})`).join(", ");
    throw new Error(`Stock insuficiente: ${labels}`);
  }

  const confirmed = { ...sale, status: "confirmada" as const, confirmedAt: now(), updatedAt: now(), syncStatus: "pending" as const };
  await db.transaction("rw", db.sales, db.inventoryMovements, async () => {
    await db.sales.update(id, confirmed);
    await applyOutboundMovements(confirmed);
  });

  return confirmed;
}

async function applyOutboundMovements(sale: Sale): Promise<void> {
  const details = await db.saleDetails.where("saleId").equals(sale.id).toArray();
  const movements: InventoryMovement[] = details.map((d) => ({
    id: crypto.randomUUID(),
    productId: d.productId,
    type: "salida" as const,
    quantity: d.quantity,
    referenceType: "venta" as const,
    referenceId: sale.id,
    notes: `Venta ${sale.code}`,
    createdAt: sale.confirmedAt ?? now(),
    syncStatus: "pending",
  }));
  if (movements.length > 0) await db.inventoryMovements.bulkAdd(movements);
}

export async function updateSale(id: string, data: SaleData): Promise<void> {
  const existing = await db.sales.get(id);
  if (!existing) throw new Error("Venta no encontrada");
  if (!canEditSale(existing.status)) {
    throw new Error("Solo las ventas pendientes pueden editarse");
  }

  const updatedAt = now();
  await db.transaction("rw", db.sales, db.saleDetails, async () => {
    await db.sales.update(id, {
      customerId: data.header.customerId,
      date: data.header.date,
      paymentMethod: data.header.paymentMethod,
      notes: data.header.notes ?? "",
      total: computeSaleTotal(data.details),
      updatedAt,
      syncStatus: "pending" as const,
    });
    await db.saleDetails.where("saleId").equals(id).delete();
    await db.saleDetails.bulkAdd(
      data.details.map((d) => buildSaleDetail(d, id, updatedAt)),
    );
  });
}

// Anular: si estaba confirmada, revierte el inventario con movimientos de
// ENTRADA de compensación (el historial de SALIDA se conserva).
export async function voidSale(id: string): Promise<void> {
  const existing = await db.sales.get(id);
  if (!existing) throw new Error("Venta no encontrada");
  if (existing.status === "anulada") throw new Error("La venta ya está anulada");

  const wasConfirmed = isConfirmed(existing);
  const voidedAt = now();

  await db.transaction("rw", db.sales, db.inventoryMovements, async () => {
    if (wasConfirmed) {
      const details = await db.saleDetails.where("saleId").equals(id).toArray();
      const movements: InventoryMovement[] = details.map((d) => ({
        id: crypto.randomUUID(),
        productId: d.productId,
        type: "entrada" as const,
        quantity: d.quantity,
        referenceType: "anulacion_venta" as const,
        referenceId: id,
        notes: `Anulación venta ${existing.code}`,
        createdAt: voidedAt,
        syncStatus: "pending",
      }));
      if (movements.length > 0) await db.inventoryMovements.bulkAdd(movements);
    }
    await db.sales.update(id, {
      status: "anulada" as const,
      voidedAt,
      updatedAt: voidedAt,
      syncStatus: "pending" as const,
    });
  });
}

export async function deleteSale(id: string): Promise<void> {
  await db.sales.update(id, {
    deleted: true,
    updatedAt: now(),
    syncStatus: "pending" as const,
  });
}
