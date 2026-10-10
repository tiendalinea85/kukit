import { db } from "@/lib/db";
import { buildInvestment, canEditInvestment } from "../domain/investmentRules";
import type { Investment, InvestmentCategory } from "@/types";
import { investmentSchema, type InvestmentFormData } from "../schemas/investmentSchema";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

function getWorkspaceId(): string {
  return useWorkspaceStore.getState().activeWorkspaceId ?? "default";
}

// El id es clave primaria: sin este filtro, el id de una inversión de otro
// workspace permitiria editarla, anularla o borrarla.
async function getActiveInvestment(id: string): Promise<Investment> {
  const investment = await db.investments.get(id);
  if (!investment || investment.workspaceId !== getWorkspaceId()) {
    throw new Error("Inversión no encontrada");
  }
  return investment;
}

export async function getInvestmentById(id: string): Promise<Investment | null> {
  const investment = await db.investments.get(id);
  return investment && investment.workspaceId === getWorkspaceId() ? investment : null;
}

export async function getInvestmentCategoryById(id: string): Promise<InvestmentCategory | null> {
  const category = await db.investmentCategories.get(id);
  return category && category.workspaceId === getWorkspaceId() ? category : null;
}

export async function createInvestment(data: InvestmentFormData): Promise<Investment> {
  const parsed = investmentSchema.parse(data);
  const now = new Date().toISOString();
  const investment = buildInvestment({ data: { ...parsed, workspaceId: getWorkspaceId() }, now });
  await db.investments.add(investment);
  return investment;
}

export async function updateInvestment(id: string, data: InvestmentFormData): Promise<void> {
  const existing = await getActiveInvestment(id);
  if (!canEditInvestment(existing.status)) {
    throw new Error("Una inversión anulada no puede editarse");
  }

  await db.investments.update(id, {
    name: data.name.trim(),
    value: data.value,
    categoryId: data.categoryId,
    supplier: data.supplier || "",
    paymentMethod: data.paymentMethod,
    status: data.status,
    date: data.date,
    notes: data.notes || "",
    updatedAt: new Date().toISOString(),
    syncStatus: "pending" as const,
  });
}

export async function voidInvestment(id: string): Promise<void> {
  const existing = await getActiveInvestment(id);
  if (existing.status === "anulado") throw new Error("La inversión ya está anulada");

  await db.investments.update(id, {
    status: "anulado" as const,
    voidedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    syncStatus: "pending" as const,
  });
}

export async function deleteInvestment(id: string): Promise<void> {
  await getActiveInvestment(id);
  await db.investments.update(id, {
    deleted: true,
    updatedAt: new Date().toISOString(),
    syncStatus: "pending" as const,
  });
}
