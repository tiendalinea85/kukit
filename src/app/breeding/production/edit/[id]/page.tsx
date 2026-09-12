"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { LivestockProductionForm } from "@/features/breeding/components/LivestockProductionForm";
import { updateLivestockProduction } from "@/features/breeding/services/breedingService";
import { db } from "@/lib/db";
import toast from "react-hot-toast";
import type { LivestockProductionFormData } from "@/features/breeding/schemas/breedingSchema";
import type { LivestockProduction } from "@/types/modules";

export default function EditProductionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [production, setProduction] = useState<LivestockProduction | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    db.livestockProductions.get(id).then((p) => p && setProduction(p));
  }, [id]);

  const handleSubmit = async (data: LivestockProductionFormData) => {
    if (!production) return;
    setLoading(true);
    try {
      const lot = await db.breedingLots.get(data.lotId);
      await updateLivestockProduction(production.id, data, lot?.name || "");
      toast.success("Producción actualizada");
      router.push("/breeding");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setLoading(false);
    }
  };

  if (!production) {
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
        <h1 className="text-xl font-bold">Editar Producción</h1>
      </div>

      <LivestockProductionForm
        onSubmit={handleSubmit}
        loading={loading}
        code={production.code}
        defaultValues={{
          lotId: production.lotId,
          type: production.type,
          quantity: production.quantity,
          unit: production.unit,
          unitPrice: production.unitPrice,
          productionDate: production.productionDate,
          notes: production.notes,
        }}
      />
    </motion.div>
  );
}
