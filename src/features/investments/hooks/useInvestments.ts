import { useState, useEffect, useCallback } from "react";
import { liveQuery } from "dexie";
import { db } from "@/lib/db";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { voidInvestment } from "../services/investmentService";
import type { Investment } from "@/types";

export function useInvestments() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    const observable = liveQuery(async () => {
      const data = await db.investments
        .where("workspaceId")
        .equals(activeWorkspaceId)
        .toArray();

      return data.filter((investment) => investment.deleted !== true);
    });

    const sub = observable.subscribe({
      next: (data) => {
        setInvestments(data);
        setLoading(false);
      },
      error: (error) => {
        console.error("Dexie: read investments", error);
        setLoading(false);
      },
    });

    return () => sub.unsubscribe();
  }, [activeWorkspaceId]);

  const remove = useCallback(async (id: string) => {
    await db.investments.update(id, { deleted: true, syncStatus: "pending" });
  }, []);

  const voidById = useCallback(async (id: string) => {
    await voidInvestment(id);
  }, []);

  return { investments, loading, remove, voidById };
}
