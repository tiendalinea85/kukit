import { useState, useEffect } from "react";
import { liveQuery } from "dexie";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { loadDashboard } from "../services/dashboardService";
import type { DashboardData } from "../services/dashboardService";

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    const observable = liveQuery(async () => loadDashboard(activeWorkspaceId));

    const sub = observable.subscribe({
      next: (value) => {
        setData(value);
        setLoading(false);
      },
      error: (error) => {
        console.error("Dexie: dashboard", error);
        setLoading(false);
      },
    });

    return () => sub.unsubscribe();
  }, [activeWorkspaceId]);

  return { data, loading };
}
