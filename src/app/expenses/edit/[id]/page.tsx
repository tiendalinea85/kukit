"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { ExpenseForm } from "@/features/expenses/components/ExpenseForm";
import { db } from "@/lib/db";
import toast from "react-hot-toast";
import type { ExpenseFormData } from "@/features/expenses/schemas/expenseSchema";
import type { Expense, ExpenseDetail } from "@/types";

export default function EditExpensePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [details, setDetails] = useState<ExpenseDetail[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    db.expenses.get(id).then((e) => {
      if (!e) return;
      setExpense(e);
      if (e.hasDetails) {
        db.expenseDetails.where({ expenseId: id }).toArray().then(setDetails);
      }
    });
  }, [id]);

  const handleSubmit = async (data: ExpenseFormData) => {
    if (!expense) return;
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const totalAmount = data.hasDetails
        ? (data.details || []).reduce((s, d) => s + d.subtotal, 0)
        : (data.amount || 0);

      await db.expenses.update(id, {
        name: data.name,
        description: data.description || "",
        amount: totalAmount,
        categoryId: data.categoryId,
        typeId: data.typeId,
        paymentMethod: data.paymentMethod,
        status: data.status,
        date: data.date,
        time: data.time,
        notes: data.notes || "",
        invoicePhoto: data.invoicePhoto,
        hasDetails: data.hasDetails,
        totalAmount,
        itemsCount: data.hasDetails ? (data.details || []).length : 0,
        updatedAt: now,
        syncStatus: "pending",
      });

      if (data.hasDetails && data.details) {
        const existingDetails = await db.expenseDetails.where({ expenseId: id }).toArray();
        const existingIds = new Set(existingDetails.map((d) => d.id));
        const newIds = new Set(data.details.map((d) => d.id));

        const toRemove = existingDetails.filter((d) => !newIds.has(d.id));
        if (toRemove.length > 0) {
          await db.expenseDetails.bulkDelete(toRemove.map((d) => d.id));
        }

        const toUpsert: ExpenseDetail[] = data.details.map((d) => ({
          id: d.id,
          expenseId: id,
          productName: d.productName,
          quantity: d.quantity,
          unitPrice: d.unitPrice,
          subtotal: d.subtotal,
          createdAt: existingIds.has(d.id)
            ? (existingDetails.find((ed) => ed.id === d.id)?.createdAt || now)
            : now,
          syncStatus: "pending" as const,
        }));
        await db.expenseDetails.bulkPut(toUpsert);
      } else {
        const existingDetails = await db.expenseDetails.where({ expenseId: id }).toArray();
        if (existingDetails.length > 0) {
          await db.expenseDetails.bulkDelete(existingDetails.map((d) => d.id));
        }
      }

      toast.success("Gasto actualizado");
      router.push(`/expenses/${id}`);
    } catch {
      toast.error("Error al actualizar");
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
          name: expense.name,
          description: expense.description,
          amount: expense.amount,
          categoryId: expense.categoryId,
          typeId: expense.typeId,
          paymentMethod: expense.paymentMethod,
          status: expense.status,
          date: expense.date,
          time: expense.time,
          notes: expense.notes,
          invoicePhoto: expense.invoicePhoto,
          hasDetails: expense.hasDetails,
          details: details.map((d) => ({
            id: d.id,
            productName: d.productName,
            quantity: d.quantity,
            unitPrice: d.unitPrice,
            subtotal: d.subtotal,
          })),
        }}
        defaultDetails={details.map((d) => ({
          id: d.id,
          productName: d.productName,
          quantity: d.quantity,
          unitPrice: d.unitPrice,
          subtotal: d.subtotal,
        }))}
      />
    </motion.div>
  );
}
