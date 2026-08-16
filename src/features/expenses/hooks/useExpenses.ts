import { useState, useEffect, useCallback } from "react";
import { liveQuery } from "dexie";
import { db } from "@/lib/db";
import { voidExpense } from "../services/expenseService";
import type { Expense } from "@/types";

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const observable = liveQuery(async () => {
      const data = await db.expenses
        .orderBy("createdAt")
        .reverse()
        .toArray();

      return data.filter((expense) => expense.deleted !== true);
    });

    const sub = observable.subscribe({
      next: (data) => {
        setExpenses(data);
        setLoading(false);
      },
      error: (error) => {
        console.error("Dexie: read expenses", error);
        setLoading(false);
      },
    });

    return () => sub.unsubscribe();
  }, []);

  const remove = useCallback(async (id: string) => {
    await db.expenses.update(id, { deleted: true, syncStatus: "pending" });
  }, []);

  const voidById = useCallback(async (id: string) => {
    await voidExpense(id);
  }, []);

  return { expenses, loading, remove, voidById };
}
