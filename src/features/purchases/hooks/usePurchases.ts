import { useState, useEffect } from "react";
import { liveQuery } from "dexie";
import { db } from "@/lib/db";
import type { Purchase } from "@/types";

export function usePurchases() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const observable = liveQuery(async () =>
      (await db.purchases.toArray()).filter((p) => !p.deleted),
    );

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
  }, []);

  return { purchases, loading };
}
