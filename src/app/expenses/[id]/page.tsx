"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Edit2, Trash2, Ban } from "lucide-react";
import { db } from "@/lib/db";
import { formatCurrency, formatDate } from "@/utils/format";
import { voidExpense, deleteExpense } from "@/features/expenses/services/expenseService";
import { canEditExpense, canVoidExpense, isVoided } from "@/features/expenses/domain/expenseRules";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import toast from "react-hot-toast";
import Link from "next/link";
import type { Expense, Category } from "@/types";

const paymentMethodLabels: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta_credito: "Tarjeta de Crédito",
  tarjeta_debito: "Tarjeta de Débito",
  yape: "Yape",
  plin: "Plin",
  transferencia: "Transferencia",
  otro: "Otro",
};

const statusLabel: Record<string, string> = {
  pagado: "Pagado",
  pendiente: "Pendiente",
  anulado: "Anulado",
};

export default function ExpenseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    db.expenses.get(id).then((e) => {
      if (!e) return;
      setExpense(e);
      db.categories.get(e.categoryId).then((c) => c && setCategory(c));
    });
  }, [id]);

  if (!expense) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleVoid = async () => {
    try {
      await voidExpense(expense.id);
      toast.success("Gasto anulado");
      setVoidOpen(false);
      db.expenses.get(expense.id).then((e) => e && setExpense(e));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo anular");
    }
  };

  const handleDelete = async () => {
    await deleteExpense(expense.id);
    toast.success("Gasto eliminado");
    setDeleteOpen(false);
    router.push("/expenses");
  };

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
            "bg-red-600/20 text-red-400"
          }`}>{statusLabel[expense.status] || expense.status}</span>
        </div>

        <div>
          <h2 className="text-2xl font-bold">{expense.description}</h2>
          {expense.notes && <p className="text-zinc-400 text-sm mt-1">{expense.notes}</p>}
        </div>

        <p className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          {formatCurrency(expense.amount)}
        </p>

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
            <p className="text-zinc-500">Método de Pago</p>
            <p className="text-zinc-200 capitalize">{paymentMethodLabels[expense.paymentMethod] || expense.paymentMethod}</p>
          </div>
          <div>
            <p className="text-zinc-500">Creado</p>
            <p className="text-zinc-200 text-xs">{formatDate(expense.createdAt)}</p>
          </div>
          {isVoided(expense) && expense.voidedAt && (
            <div>
              <p className="text-zinc-500">Anulado</p>
              <p className="text-zinc-200 text-xs">{formatDate(expense.voidedAt)}</p>
            </div>
          )}
        </div>

        {isVoided(expense) && (
          <div className="rounded-xl bg-red-600/10 border border-red-600/30 p-3 text-sm text-red-400">
            Este gasto fue anulado y no puede modificarse.
          </div>
        )}

        {expense.receiptPhoto && (
          <div>
            <p className="text-sm text-zinc-500 mb-1">Comprobante</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={expense.receiptPhoto} alt="Comprobante"
              className="w-full rounded-xl border border-zinc-700/50 cursor-pointer"
              onClick={() => window.open(expense.receiptPhoto, "_blank")}
            />
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {canEditExpense(expense.status) && (
          <Link href={`/expenses/edit/${expense.id}`} className="flex-1">
            <Button variant="secondary" className="w-full"><Edit2 size={16} /> Editar</Button>
          </Link>
        )}
        {canVoidExpense(expense.status) && (
          <Button variant="danger" className="flex-1" onClick={() => setVoidOpen(true)}>
            <Ban size={16} /> Anular
          </Button>
        )}
        <Button variant="ghost" className="flex-1" onClick={() => setDeleteOpen(true)}>
          <Trash2 size={16} /> Eliminar
        </Button>
      </div>

      <Modal open={voidOpen} onClose={() => setVoidOpen(false)} title="Anular Gasto">
        <p className="text-zinc-400 mb-4">¿Anular este gasto por <strong className="text-zinc-200">{formatCurrency(expense.amount)}</strong>? Un gasto anulado no puede editarse.</p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setVoidOpen(false)}>Cancelar</Button>
          <Button variant="danger" className="flex-1" onClick={handleVoid}>Anular</Button>
        </div>
      </Modal>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Eliminar Gasto">
        <p className="text-zinc-400 mb-4">¿Enviar este gasto a la papelera? Puedes recuperarlo desde ahí.</p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
          <Button variant="danger" className="flex-1" onClick={handleDelete}>Eliminar</Button>
        </div>
      </Modal>
    </motion.div>
  );
}
