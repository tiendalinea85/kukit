"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { ExpenseForm } from "@/features/expenses/components/ExpenseForm";
import { createExpense } from "@/features/expenses/services/expenseService";
import { useExpenseProducts } from "@/features/expenses/hooks/useExpenseProducts";
import { generateExpenseCode } from "@/utils/code";
import toast from "react-hot-toast";
import type { ExpenseFormData } from "@/features/expenses/schemas/expenseSchema";
import type { ExpenseDetailInput } from "@/types";

export default function NewExpensePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { products } = useExpenseProducts();

  useEffect(() => {
    generateExpenseCode().then(setCode);
  }, []);

  const handleSubmit = async (data: ExpenseFormData, details: ExpenseDetailInput[]) => {
    setLoading(true);
    try {
      await createExpense(data, code, details);
      toast.success("Gasto registrado exitosamente");
      router.push("/expenses");
    } catch {
      toast.error("Error al registrar gasto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">Nuevo Gasto</h1>
      </div>
      <ExpenseForm onSubmit={handleSubmit} loading={loading} code={code} products={products} />
    </motion.div>
  );
}

