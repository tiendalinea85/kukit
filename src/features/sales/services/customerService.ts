import { db } from "@/lib/db";
import type { Customer } from "@/types";
import type { CustomerFormData } from "../schemas/customerSchema";

function now(): string {
  return new Date().toISOString();
}

export async function createCustomer(data: CustomerFormData): Promise<Customer> {
  const customer: Customer = {
    id: crypto.randomUUID(),
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
  const existing = await db.customers.get(id);
  if (!existing) throw new Error("Cliente no encontrado");

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
  await db.customers.update(id, {
    deleted: true,
    updatedAt: now(),
    syncStatus: "pending" as const,
  });
}
