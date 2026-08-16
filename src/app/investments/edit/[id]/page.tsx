"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Lock } from "lucide-react";
import { InvestmentForm } from "@/features/investments/components/InvestmentForm";
import { updateInvestment } from "@/features/investments/services/investmentService";
import { isVoided } from "@/features/investments/domain/investmentRules";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";
import type { InvestmentFormData } from "@/features/investments/schemas/investmentSchema";
import type { Investment } from "@/types";

export default function EditInvestmentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [investment, setInvestment] = useState<Investment | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    db.investments.get(id).then((e) => e && setInvestment(e));
  }, [id]);

  const handleSubmit = async (data: InvestmentFormData) => {
    if (!investment) return;
    setLoading(true);
    try {
      await updateInvestment(investment.id, data);
      toast.success("Inversión actualizada");
      router.push(`/investments/${investment.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
      router.push(`/investments/${investment.id}`);
    } finally {
      setLoading(false);
    }
  };

  if (!investment) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isVoided(investment)) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold">Editar Inversión</h1>
        </div>
        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-8 text-center space-y-3">
          <Lock size={28} className="mx-auto text-zinc-600" />
          <p className="text-zinc-300 font-medium">Esta inversión está anulada</p>
          <p className="text-sm text-zinc-500">Una inversión anulada no puede editarse. Consulta el detalle para más información.</p>
          <Button variant="secondary" className="mx-auto" onClick={() => router.push(`/investments/${investment.id}`)}>
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
        <h1 className="text-xl font-bold">Editar Inversión</h1>
      </div>

      <InvestmentForm
        onSubmit={handleSubmit}
        loading={loading}
        defaultValues={{
          name: investment.name,
          value: investment.value,
          categoryId: investment.categoryId,
          supplier: investment.supplier,
          paymentMethod: investment.paymentMethod,
          status: investment.status,
          date: investment.date,
          notes: investment.notes,
        }}
      />
    </motion.div>
  );
}
