import { useState, useEffect, useCallback } from "react";
import { liveQuery } from "dexie";
import { db } from "@/lib/db";
import { voidSale } from "../services/saleService";
import type { Sale } from "@/types";

export function useSales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const observable = liveQuery(async () => {
      const data = await db.sales
        .orderBy("createdAt")
        .reverse()
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
  }, []);

  const voidById = useCallback(async (id: string) => {
    await voidSale(id);
  }, []);

  const remove = useCallback(async (id: string) => {
    await db.sales.update(id, { deleted: true, syncStatus: "pending" });
  }, []);

  return { sales, loading, voidById, remove };
}
