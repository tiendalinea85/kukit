import { useState, useEffect } from "react";
import { liveQuery } from "dexie";
import { db } from "@/lib/db";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import type { Product } from "@/types";

export function useExpenseProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    const observable = liveQuery(async () => {
      const data = await db.products
        .where("workspaceId")
        .equals(activeWorkspaceId)
        .toArray();

      return data
        .filter((p) => p.deleted !== true)
        .sort((a, b) => a.name.localeCompare(b.name));
    });

    const sub = observable.subscribe({
      next: (data) => {
        setProducts(data);
        setLoading(false);
      },
      error: (error) => {
        console.error("Dexie: read products", error);
        setLoading(false);
      },
    });

    return () => sub.unsubscribe();
  }, [activeWorkspaceId]);

  return { products, loading };
}