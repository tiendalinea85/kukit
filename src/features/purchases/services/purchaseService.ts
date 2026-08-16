import { db } from "@/lib/db";
import { generatePurchaseCode } from "@/utils/code";
import {
  buildPurchase,
  buildPurchaseDetail,
  canEditPurchase,
  computePurchaseTotal,
  isReceived,
} from "../domain/purchaseRules";
import type { Purchase, PurchaseDetail, InventoryMovement } from "@/types";
import type { PurchaseFormData } from "../schemas/purchaseSchema";
import type { PurchaseDetailInput } from "../domain/purchaseRules";

function now(): string {
  return new Date().toISOString();
}

export interface PurchaseData {
  header: PurchaseFormData;
  details: PurchaseDetailInput[];
}

export async function createPurchase(data: PurchaseData, options?: { receive?: boolean }): Promise<Purchase> {
  const code = await generatePurchaseCode();
  const purchase = buildPurchase(
    {
      supplier: data.header.supplier,
      date: data.header.date,
      paymentMethod: data.header.paymentMethod,
      notes: data.header.notes ?? "",
      status: options?.receive ? "recibida" : "pendiente",
      details: data.details,
    },
    code,
    now(),
  );

  await db.transaction("rw", db.purchases, db.purchaseDetails, db.inventoryMovements, async () => {
    await db.purchases.add(purchase);
    await db.purchaseDetails.bulkAdd(
      data.details.map((d) => buildPurchaseDetail(d, purchase.id, purchase.createdAt)),
    );
    if (options?.receive) {
      await applyInboundMovements(purchase);
    }
  });

  return purchase;
}

// Recibir: pendiente -> recibida. Genera movimientos ENTRADA de inventario.
export async function receivePurchase(id: string): Promise<Purchase> {
  const purchase = await db.purchases.get(id);
  if (!purchase) throw new Error("Compra no encontrada");
  if (purchase.status !== "pendiente") throw new Error("Solo las compras pendientes pueden recibirse");

  const details = await db.purchaseDetails.where("purchaseId").equals(id).toArray();
  if (details.length === 0) throw new Error("La compra no tiene detalle de productos");

  const received = { ...purchase, status: "recibida" as const, receivedAt: now(), updatedAt: now(), syncStatus: "pending" as const };
  await db.transaction("rw", db.purchases, db.inventoryMovements, async () => {
    await db.purchases.update(id, received);
    await applyInboundMovements(received);
  });

  return received;
}

async function applyInboundMovements(purchase: Purchase): Promise<void> {
  const details = await db.purchaseDetails.where("purchaseId").equals(purchase.id).toArray();
  const movements: InventoryMovement[] = details.map((d) => ({
    id: crypto.randomUUID(),
    productId: d.productId,
    type: "entrada" as const,
    quantity: d.quantity,
    referenceType: "compra" as const,
    referenceId: purchase.id,
    notes: `Compra ${purchase.code}`,
    createdAt: purchase.receivedAt ?? now(),
    syncStatus: "pending",
  }));
  if (movements.length > 0) await db.inventoryMovements.bulkAdd(movements);
}

export async function updatePurchase(id: string, data: PurchaseData): Promise<void> {
  const existing = await db.purchases.get(id);
  if (!existing) throw new Error("Compra no encontrada");
  if (!canEditPurchase(existing.status)) {
    throw new Error("Solo las compras pendientes pueden editarse");
  }

  const updatedAt = now();
  await db.transaction("rw", db.purchases, db.purchaseDetails, async () => {
    await db.purchases.update(id, {
      supplier: data.header.supplier,
      date: data.header.date,
      paymentMethod: data.header.paymentMethod,
      notes: data.header.notes ?? "",
      total: computePurchaseTotal(data.details),
      updatedAt,
      syncStatus: "pending" as const,
    });
    await db.purchaseDetails.where("purchaseId").equals(id).delete();
    await db.purchaseDetails.bulkAdd(
      data.details.map((d) => buildPurchaseDetail(d, id, updatedAt)),
    );
  });
}

// Anular: si estaba recibida, revierte el inventario con movimientos de SALIDA
// de compensación (el historial de ENTRADA se conserva).
export async function voidPurchase(id: string): Promise<void> {
  const existing = await db.purchases.get(id);
  if (!existing) throw new Error("Compra no encontrada");
  if (existing.status === "anulada") throw new Error("La compra ya está anulada");

  const wasReceived = isReceived(existing);
  const voidedAt = now();

  await db.transaction("rw", db.purchases, db.inventoryMovements, async () => {
    if (wasReceived) {
      const details = await db.purchaseDetails.where("purchaseId").equals(id).toArray();
      const movements: InventoryMovement[] = details.map((d) => ({
        id: crypto.randomUUID(),
        productId: d.productId,
        type: "salida" as const,
        quantity: d.quantity,
        referenceType: "anulacion_compra" as const,
        referenceId: id,
        notes: `Anulación compra ${existing.code}`,
        createdAt: voidedAt,
        syncStatus: "pending",
      }));
      if (movements.length > 0) await db.inventoryMovements.bulkAdd(movements);
    }
    await db.purchases.update(id, {
      status: "anulada" as const,
      voidedAt,
      updatedAt: voidedAt,
      syncStatus: "pending" as const,
    });
  });
}

export async function deletePurchase(id: string): Promise<void> {
  await db.purchases.update(id, {
    deleted: true,
    updatedAt: now(),
    syncStatus: "pending" as const,
  });
}

export async function listPurchaseDetailsByPurchase(): Promise<Record<string, PurchaseDetail[]>> {
  const details = await db.purchaseDetails.toArray();
  const map: Record<string, PurchaseDetail[]> = {};
  for (const d of details) (map[d.purchaseId] ??= []).push(d);
  return map;
}
