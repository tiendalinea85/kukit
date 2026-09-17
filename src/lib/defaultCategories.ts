import { db } from "./db";
import { getCurrentUser } from "./supabase";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

export const DEFAULT_CATEGORIES = [
  { name: "Efectivo", icon: "💰", color: "#10b981" },
  { name: "Alquiler", icon: "🏠", color: "#8b5cf6" },
  { name: "Proveedores", icon: "📦", color: "#f59e0b" },
  { name: "Transporte", icon: "🚗", color: "#3b82f6" },
  { name: "Servicios", icon: "💡", color: "#f97316" },
  { name: "Suministros", icon: "🛒", color: "#06b6d4" },
] as const;

let seeding: Promise<boolean> | null = null;

export async function seedCategoriesIfEmpty(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const count = await db.categories.count();
  if (count > 0) return false;

  const workspaceId = useWorkspaceStore.getState().activeWorkspaceId ?? "default";
  const now = new Date().toISOString();

  await db.categories.bulkAdd(
    DEFAULT_CATEGORIES.map((c) => ({
      id: crypto.randomUUID(),
      workspaceId,
      name: c.name,
      icon: c.icon,
      color: c.color,
      createdAt: now,
      syncStatus: "pending" as const,
    })),
  );
  return true;
}

export function ensureDefaultCategories(): Promise<boolean> {
  if (!seeding) {
    seeding = getCurrentUser().then((user) => seedCategoriesIfEmpty(user?.id ?? null)).finally(() => {
      seeding = null;
    });
  }
  return seeding;
}