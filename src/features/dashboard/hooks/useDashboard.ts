import { useState, useEffect } from "react";
import { liveQuery } from "dexie";
import { loadDashboard } from "../services/dashboardService";
import type { DashboardData } from "../services/dashboardService";

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const observable = liveQuery(async () => loadDashboard());

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
  }, []);

  return { data, loading };
}
