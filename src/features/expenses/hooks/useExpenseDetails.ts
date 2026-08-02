"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/db";
import type { ExpenseDetail } from "@/types";

export function useExpenseDetails(expenseId: string | null) {
  const [details, setDetails] = useState<ExpenseDetail[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!expenseId) {
      setDetails([]);
      return;
    }
    setLoading(true);
    db.expenseDetails.where({ expenseId }).toArray().then((data) => {
      setDetails(data);
      setLoading(false);
    });
  }, [expenseId]);

  return { details, loading };
}
