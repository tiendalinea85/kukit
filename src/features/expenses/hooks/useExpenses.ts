import { useState, useEffect, useCallback } from "react";
import { liveQuery } from "dexie";
import { db } from "@/lib/db";
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

      return data.filter(expense => expense.deleted !== true);
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

  const duplicate = useCallback(async (expense: Expense) => {
    const { generateExpenseCode } = await import("@/utils/code");
    const newExpense: Expense = {
      ...expense,
      id: crypto.randomUUID(),
      code: await generateExpenseCode(),
      date: new Date().toISOString().split("T")[0],
      time: new Date().toTimeString().slice(0, 5),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deleted: false,
      syncStatus: "pending",
    };
    await db.expenses.add(newExpense);
  }, []);

  return { expenses, loading, remove, duplicate };
}
