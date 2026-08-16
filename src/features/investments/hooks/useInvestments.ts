import { useState, useEffect, useCallback } from "react";
import { liveQuery } from "dexie";
import { db } from "@/lib/db";
import { voidInvestment } from "../services/investmentService";
import type { Investment } from "@/types";

export function useInvestments() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const observable = liveQuery(async () => {
      const data = await db.investments
        .orderBy("createdAt")
        .reverse()
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
  }, []);

  const remove = useCallback(async (id: string) => {
    await db.investments.update(id, { deleted: true, syncStatus: "pending" });
  }, []);

  const voidById = useCallback(async (id: string) => {
    await voidInvestment(id);
  }, []);

  return { investments, loading, remove, voidById };
}
