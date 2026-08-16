"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Edit2, Trash2, Ban, Briefcase } from "lucide-react";
import { db } from "@/lib/db";
import { formatCurrency, formatDate } from "@/utils/format";
import { voidInvestment, deleteInvestment } from "@/features/investments/services/investmentService";
import { canEditInvestment, canVoidInvestment, isVoided } from "@/features/investments/domain/investmentRules";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import toast from "react-hot-toast";
import Link from "next/link";
import type { Investment, InvestmentCategory } from "@/types";

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

export default function InvestmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [investment, setInvestment] = useState<Investment | null>(null);
  const [category, setCategory] = useState<InvestmentCategory | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    db.investments.get(id).then((e) => {
      if (!e) return;
      setInvestment(e);
      db.investmentCategories.get(e.categoryId).then((c) => c && setCategory(c));
    });
  }, [id]);

  if (!investment) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleVoid = async () => {
    try {
      await voidInvestment(investment.id);
      toast.success("Inversión anulada");
      setVoidOpen(false);
      db.investments.get(investment.id).then((e) => e && setInvestment(e));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo anular");
    }
  };

  const handleDelete = async () => {
    await deleteInvestment(investment.id);
    toast.success("Inversión eliminada");
    setDeleteOpen(false);
    router.push("/investments");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">Detalle de la Inversión</h1>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-900/50 border border-zinc-800 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs text-purple-500 bg-purple-600/10 px-3 py-1 rounded-lg">
            <Briefcase size={14} /> INVERSIÓN
          </span>
          <span className={`text-xs px-3 py-1 rounded-full ${
            investment.status === "pagado" ? "bg-emerald-600/20 text-emerald-400" :
            investment.status === "pendiente" ? "bg-amber-600/20 text-amber-400" :
            "bg-red-600/20 text-red-400"
          }`}>{statusLabel[investment.status] || investment.status}</span>
        </div>

        <div>
          <h2 className="text-2xl font-bold">{investment.name}</h2>
          {investment.notes && <p className="text-zinc-400 text-sm mt-1">{investment.notes}</p>}
        </div>

        <p className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          {formatCurrency(investment.value)}
        </p>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-zinc-500">Fecha</p>
            <p className="text-zinc-200">{formatDate(investment.date)}</p>
          </div>
          <div>
            <p className="text-zinc-500">Categoría</p>
            <p className="text-zinc-200">{category ? `${category.icon} ${category.name}` : "-"}</p>
          </div>
          <div>
            <p className="text-zinc-500">Proveedor</p>
            <p className="text-zinc-200">{investment.supplier || "-"}</p>
          </div>
          <div>
            <p className="text-zinc-500">Método de Pago</p>
            <p className="text-zinc-200 capitalize">{paymentMethodLabels[investment.paymentMethod] || investment.paymentMethod}</p>
          </div>
          <div>
            <p className="text-zinc-500">Creado</p>
            <p className="text-zinc-200 text-xs">{formatDate(investment.createdAt)}</p>
          </div>
          {isVoided(investment) && investment.voidedAt && (
            <div>
              <p className="text-zinc-500">Anulado</p>
              <p className="text-zinc-200 text-xs">{formatDate(investment.voidedAt)}</p>
            </div>
          )}
        </div>

        {isVoided(investment) && (
          <div className="rounded-xl bg-red-600/10 border border-red-600/30 p-3 text-sm text-red-400">
            Esta inversión fue anulada y no puede modificarse.
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {canEditInvestment(investment.status) && (
          <Link href={`/investments/edit/${investment.id}`} className="flex-1">
            <Button variant="secondary" className="w-full"><Edit2 size={16} /> Editar</Button>
          </Link>
        )}
        {canVoidInvestment(investment.status) && (
          <Button variant="danger" className="flex-1" onClick={() => setVoidOpen(true)}>
            <Ban size={16} /> Anular
          </Button>
        )}
        <Button variant="ghost" className="flex-1" onClick={() => setDeleteOpen(true)}>
          <Trash2 size={16} /> Eliminar
        </Button>
      </div>

      <Modal open={voidOpen} onClose={() => setVoidOpen(false)} title="Anular Inversión">
        <p className="text-zinc-400 mb-4">¿Anular esta inversión <strong className="text-zinc-200">{investment.name}</strong> por <strong className="text-zinc-200">{formatCurrency(investment.value)}</strong>? Una inversión anulada no puede editarse.</p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setVoidOpen(false)}>Cancelar</Button>
          <Button variant="danger" className="flex-1" onClick={handleVoid}>Anular</Button>
        </div>
      </Modal>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Eliminar Inversión">
        <p className="text-zinc-400 mb-4">¿Enviar esta inversión a la papelera? Puedes recuperarla desde ahí.</p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
          <Button variant="danger" className="flex-1" onClick={handleDelete}>Eliminar</Button>
        </div>
      </Modal>
    </motion.div>
  );
}
