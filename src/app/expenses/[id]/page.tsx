"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Edit2, Trash2, Copy, ImageIcon, ChevronDown, ChevronUp } from "lucide-react";
import { db } from "@/lib/db";
import { formatCurrency, formatDate } from "@/utils/format";
import { Button } from "@/components/ui/Button";
import { ExpenseDetailsDialog } from "@/features/expenses/components/ExpenseDetailsDialog";
import toast from "react-hot-toast";
import Link from "next/link";
import type { Expense, ExpenseDetail, Category, Type } from "@/types";

export default function ExpenseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [type, setType] = useState<Type | null>(null);
  const [details, setDetails] = useState<ExpenseDetail[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    db.expenses.get(id).then((e) => {
      if (!e) return;
      setExpense(e);
      db.categories.get(e.categoryId).then((c) => c && setCategory(c));
      db.types.get(e.typeId).then((t) => t && setType(t));
      if (e.hasDetails) {
        db.expenseDetails.where({ expenseId: id }).toArray().then(setDetails);
      }
    });
  }, [id]);

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
        <h1 className="text-xl font-bold">Detalle del Gasto</h1>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-900/50 border border-zinc-800 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-purple-500 bg-purple-600/10 px-3 py-1 rounded-lg">{expense.code}</span>
          <span className={`text-xs px-3 py-1 rounded-full ${
            expense.status === "pagado" ? "bg-emerald-600/20 text-emerald-400" :
            expense.status === "pendiente" ? "bg-amber-600/20 text-amber-400" :
            expense.status === "cancelado" ? "bg-red-600/20 text-red-400" :
            "bg-blue-600/20 text-blue-400"
          }`}>{expense.status}</span>
        </div>

        <h2 className="text-2xl font-bold">{expense.name}</h2>
        {expense.description && <p className="text-zinc-400 text-sm">{expense.description}</p>}

        <p className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          {formatCurrency(expense.totalAmount || expense.amount)}
        </p>

        {expense.hasDetails && (
          <button
            onClick={() => setDetailOpen(true)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-800/40 border border-zinc-700/30 hover:bg-zinc-800/60 transition-colors"
          >
            <span className="text-sm text-zinc-400">
              {details.length} concepto(s) registrado(s)
            </span>
            <ChevronDown size={16} className="text-zinc-500" />
          </button>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-zinc-500">Fecha</p>
            <p className="text-zinc-200">{formatDate(expense.date)}</p>
          </div>
          <div>
            <p className="text-zinc-500">Hora</p>
            <p className="text-zinc-200">{expense.time}</p>
          </div>
          <div>
            <p className="text-zinc-500">Categoría</p>
            <p className="text-zinc-200">{category ? `${category.icon} ${category.name}` : "-"}</p>
          </div>
          <div>
            <p className="text-zinc-500">Tipo</p>
            <p className="text-zinc-200">{type?.name || "-"}</p>
          </div>
          <div>
            <p className="text-zinc-500">Método de Pago</p>
            <p className="text-zinc-200 capitalize">{expense.paymentMethod.replace("_", " ")}</p>
          </div>
          <div>
            <p className="text-zinc-500">Creado</p>
            <p className="text-zinc-200 text-xs">{formatDate(expense.createdAt)}</p>
          </div>
        </div>

        {expense.notes && (
          <div>
            <p className="text-sm text-zinc-500 mb-1">Observaciones</p>
            <p className="text-sm text-zinc-300 bg-zinc-800/40 rounded-xl p-3">{expense.notes}</p>
          </div>
        )}

        {expense.invoicePhoto && (
          <div>
            <p className="text-sm text-zinc-500 mb-1">Factura</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={expense.invoicePhoto} alt="Factura"
              className="w-full rounded-xl border border-zinc-700/50 cursor-pointer"
              onClick={() => window.open(expense.invoicePhoto, "_blank")}
            />
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Link href={`/expenses/edit/${expense.id}`} className="flex-1">
          <Button variant="secondary" className="w-full"><Edit2 size={16} /> Editar</Button>
        </Link>
        <Button variant="danger" className="flex-1"
          onClick={async () => {
            await db.expenses.update(expense.id, { deleted: true, syncStatus: "pending" });
            toast.success("Gasto eliminado");
            router.push("/expenses");
          }}
        ><Trash2 size={16} /> Eliminar</Button>
      </div>

      <ExpenseDetailsDialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        details={details}
        expenseName={expense.name}
      />
    </motion.div>
  );
}
