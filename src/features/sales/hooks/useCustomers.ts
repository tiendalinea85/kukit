import { useState, useEffect } from "react";
import { liveQuery } from "dexie";
import { db } from "@/lib/db";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import type { Customer } from "@/types";

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    const observable = liveQuery(async () => {
      const data = await db.customers
        .where("workspaceId")
        .equals(activeWorkspaceId)
        .toArray();
      return data.filter((c) => c.deleted !== true);
    });

    const sub = observable.subscribe({
      next: (data) => {
        setCustomers(data);
        setLoading(false);
      },
      error: (error) => {
        console.error("Dexie: read customers", error);
        setLoading(false);
      },
    });

    return () => sub.unsubscribe();
  }, [activeWorkspaceId]);

  return { customers, loading };
}
