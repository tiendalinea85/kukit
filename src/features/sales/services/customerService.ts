import { newId } from "@/utils/id";
import { db } from "@/lib/db";
import type { Customer } from "@/types";
import type { CustomerFormData } from "../schemas/customerSchema";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

function getWorkspaceId(): string {
  return useWorkspaceStore.getState().activeWorkspaceId ?? "default";
}

function now(): string {
  return new Date().toISOString();
}

// El id es clave primaria: sin este filtro, el id de un cliente de otro
// workspace permitiria editarlo o borrarlo.
async function getActiveCustomer(id: string): Promise<Customer> {
  const customer = await db.customers.get(id);
  if (!customer || customer.workspaceId !== getWorkspaceId()) {
    throw new Error("Cliente no encontrado");
  }
  return customer;
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const customer = await db.customers.get(id);
  return customer && customer.workspaceId === getWorkspaceId() ? customer : null;
}

export async function createCustomer(data: CustomerFormData): Promise<Customer> {
  const customer: Customer = {
    id: newId(),
    workspaceId: getWorkspaceId(),
    name: data.name.trim(),
    phone: data.phone?.trim() ?? "",
    address: data.address?.trim() ?? "",
    notes: data.notes?.trim() ?? "",
    createdAt: now(),
    updatedAt: now(),
    deleted: false,
    syncStatus: "pending",
  };
  await db.customers.add(customer);
  return customer;
}

export async function updateCustomer(id: string, data: CustomerFormData): Promise<void> {
  await getActiveCustomer(id);

  await db.customers.update(id, {
    name: data.name.trim(),
    phone: data.phone?.trim() ?? "",
    address: data.address?.trim() ?? "",
    notes: data.notes?.trim() ?? "",
    updatedAt: now(),
    syncStatus: "pending" as const,
  });
}

export async function deleteCustomer(id: string): Promise<void> {
  await getActiveCustomer(id);
  await db.customers.update(id, {
    deleted: true,
    updatedAt: now(),
    syncStatus: "pending" as const,
  });
}
