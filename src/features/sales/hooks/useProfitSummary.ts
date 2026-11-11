import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { getProfitSummary } from "../services/profitService";
import type { ProfitSummary } from "../domain/saleProfit";

export function useProfitSummary(dateFrom: string, dateTo: string) {
  const [data, setData] = useState<ProfitSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  useEffect(() => {
    if (!activeWorkspaceId || !dateFrom || !dateTo) {
      setData(null);
      setLoading(false);
      return;
    }

    const observable = liveQuery(() =>
      getProfitSummary({ dateFrom, dateTo, workspaceId: activeWorkspaceId }),
    );

    const sub = observable.subscribe({
      next: (value) => {
        setData(value);
        setLoading(false);
      },
      error: (error) => {
        console.error("Dexie: profit summary", error);
        setLoading(false);
      },
    });

    return () => sub.unsubscribe();
  }, [activeWorkspaceId, dateFrom, dateTo]);

  return { data, loading };
}
