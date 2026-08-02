"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { RotateCcw, Trash2 } from "lucide-react";
import { liveQuery } from "dexie";
import { db } from "@/lib/db";
import { formatCurrency, formatDate } from "@/utils/format";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";
import type { Expense } from "@/types";

export default function TrashPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    const obs = liveQuery(() => db.expenses.where({ deleted: true }).reverse().sortBy("updatedAt"));
    const sub = obs.subscribe((data) => setExpenses(data));
    return () => sub.unsubscribe();
  }, []);

  const handleRestore = async (id: string) => {
    await db.expenses.update(id, { deleted: false, syncStatus: "pending" });
    toast.success("Gasto restaurado");
  };

  const handlePermanentDelete = async (id: string) => {
    await db.expenses.delete(id);
    toast.success("Gasto eliminado permanentemente");
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <h1 className="text-xl font-bold">Papelera</h1>
      <p className="text-sm text-zinc-500">Los gastos eliminados se pueden recuperar.</p>

      {expenses.length === 0 ? (
        <div className="text-center py-16">
          <Trash2 size={40} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-600">La papelera está vacía</p>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((e, i) => (
            <motion.div key={e.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="flex items-center justify-between rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-zinc-300 truncate">{e.name}</p>
                <p className="text-xs text-zinc-600">{e.code} • {formatDate(e.date)} • {formatCurrency(e.totalAmount || e.amount)}</p>
              </div>
              <div className="flex gap-1 ml-3">
                <button onClick={() => handleRestore(e.id)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-emerald-400">
                  <RotateCcw size={14} />
                </button>
                <button onClick={() => handlePermanentDelete(e.id)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400">
                  <Trash2 size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
