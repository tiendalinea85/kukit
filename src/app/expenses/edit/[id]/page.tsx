"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Lock } from "lucide-react";
import { ExpenseForm } from "@/features/expenses/components/ExpenseForm";
import { updateExpense } from "@/features/expenses/services/expenseService";
import { isVoided } from "@/features/expenses/domain/expenseRules";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";
import type { ExpenseFormData } from "@/features/expenses/schemas/expenseSchema";
import type { Expense } from "@/types";

export default function EditExpensePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    db.expenses.get(id).then((e) => e && setExpense(e));
  }, [id]);

  const handleSubmit = async (data: ExpenseFormData) => {
    if (!expense) return;
    setLoading(true);
    try {
      await updateExpense(expense.id, data);
      toast.success("Gasto actualizado");
      router.push(`/expenses/${expense.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
      router.push(`/expenses/${expense.id}`);
    } finally {
      setLoading(false);
    }
  };

  if (!expense) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isVoided(expense)) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold">Editar Gasto</h1>
        </div>
        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-8 text-center space-y-3">
          <Lock size={28} className="mx-auto text-zinc-600" />
          <p className="text-zinc-300 font-medium">Este gasto está anulado</p>
          <p className="text-sm text-zinc-500">Un gasto anulado no puede editarse. Consulta el detalle para más información.</p>
          <Button variant="secondary" className="mx-auto" onClick={() => router.push(`/expenses/${expense.id}`)}>
            Ver detalle
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">Editar Gasto</h1>
      </div>

      <ExpenseForm
        onSubmit={handleSubmit}
        loading={loading}
        code={expense.code}
        defaultValues={{
          description: expense.description,
          amount: expense.amount,
          categoryId: expense.categoryId,
          paymentMethod: expense.paymentMethod,
          status: expense.status,
          date: expense.date,
          time: expense.time,
          notes: expense.notes,
          receiptPhoto: expense.receiptPhoto,
        }}
      />
    </motion.div>
  );
}
