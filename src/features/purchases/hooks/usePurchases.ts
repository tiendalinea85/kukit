import { useState, useEffect } from "react";
import { liveQuery } from "dexie";
import { db } from "@/lib/db";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import type { Purchase } from "@/types";

export function usePurchases() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    const observable = liveQuery(async () => {
      const data = await db.purchases
        .where("workspaceId")
        .equals(activeWorkspaceId)
        .toArray();
      return data.filter((p) => !p.deleted);
    });

    const sub = observable.subscribe({
      next: (data) => {
        setPurchases(data);
        setLoading(false);
      },
      error: (error) => {
        console.error("Dexie: read purchases", error);
        setLoading(false);
      },
    });

    return () => sub.unsubscribe();
  }, [activeWorkspaceId]);

  return { purchases, loading };
}
