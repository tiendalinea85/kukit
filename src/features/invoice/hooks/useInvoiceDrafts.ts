"use client";
import { useState, useEffect, useCallback } from "react";
import { liveQuery } from "dexie";
import { db } from "@/lib/db";
import { discardDraft, deleteDraft } from "../services/invoiceDraftService";
import type { InvoiceDraft } from "../domain/types";

export function useInvoiceDrafts() {
  const [drafts, setDrafts] = useState<InvoiceDraft[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const observable = liveQuery(async () => {
      const all = await db.invoiceDrafts.orderBy("createdAt").reverse().toArray();
      return all.filter((d) => d.status !== "discarded" && d.status !== "confirmed");
    });
    const sub = observable.subscribe({
      next: (data) => {
        setDrafts(data);
        setLoading(false);
      },
      error: () => setLoading(false),
    });
    return () => sub.unsubscribe();
  }, []);

  const remove = useCallback(async (id: string) => {
    await discardDraft(id);
  }, []);

  const hardDelete = useCallback(async (id: string) => {
    await deleteDraft(id);
  }, []);

  return { drafts, loading, remove, hardDelete };
}
