import { useState, useEffect } from "react";
import { liveQuery } from "dexie";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { listProductsWithStock } from "../services/productService";
import type { ProductWithStock } from "../services/productService";

export function useProducts() {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    const observable = liveQuery(async () => {
      const all = await listProductsWithStock();
      return all.filter((p) => p.workspaceId === activeWorkspaceId);
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
