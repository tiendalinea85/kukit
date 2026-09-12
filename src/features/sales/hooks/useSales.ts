import { useState, useEffect, useCallback } from "react";
import { liveQuery } from "dexie";
import { db } from "@/lib/db";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { voidSale } from "../services/saleService";
import type { Sale } from "@/types";

export function useSales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    const observable = liveQuery(async () => {
      const data = await db.sales
        .where("workspaceId")
        .equals(activeWorkspaceId)
        .toArray();
      return data.filter((s) => s.deleted !== true);
    });

    const sub = observable.subscribe({
      next: (data) => {
        setSales(data);
        setLoading(false);
      },
      error: (error) => {
        console.error("Dexie: read sales", error);
        setLoading(false);
      },
    });

    return () => sub.unsubscribe();
  }, [activeWorkspaceId]);

  const voidById = useCallback(async (id: string) => {
    await voidSale(id);
  }, []);

  const remove = useCallback(async (id: string) => {
    await db.sales.update(id, { deleted: true, syncStatus: "pending" });
  }, []);

  return { sales, loading, voidById, remove };
}
