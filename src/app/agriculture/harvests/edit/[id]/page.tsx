"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { HarvestForm } from "@/features/agriculture/components/HarvestForm";
import { updateHarvest } from "@/features/agriculture/services/agricultureService";
import { useCrops, useFarmLots } from "@/features/agriculture/hooks/useAgriculture";
import { db } from "@/lib/db";
import toast from "react-hot-toast";
import type { HarvestFormData } from "@/features/agriculture/schemas/agricultureSchema";
import type { Harvest } from "@/types/modules";

export default function EditHarvestPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [harvest, setHarvest] = useState<Harvest | null>(null);
  const [loading, setLoading] = useState(false);
  const { crops } = useCrops();
  const { farmLots } = useFarmLots();

  useEffect(() => {
    db.harvests.get(id).then((h) => h && setHarvest(h));
  }, [id]);

  const handleSubmit = async (data: HarvestFormData) => {
    if (!harvest) return;
    setLoading(true);
    try {
      await updateHarvest(harvest.id, data, crops, farmLots);
      toast.success("Cosecha actualizada");
      router.push("/agriculture");
    } catch {
      toast.error("Error al actualizar cosecha");
    } finally {
      setLoading(false);
    }
  };

  if (!harvest) {
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
        <h1 className="text-xl font-bold">Editar Cosecha</h1>
      </div>
      <HarvestForm
        onSubmit={handleSubmit}
        loading={loading}
        code={harvest.code}
        defaultValues={{
          cropId: harvest.cropId,
          lotId: harvest.lotId,
          product: harvest.product,
          quantity: harvest.quantity,
          unit: harvest.unit,
          unitPrice: harvest.unitPrice,
          harvestDate: harvest.harvestDate,
          quality: harvest.quality,
          notes: harvest.notes,
        }}
      />
    </motion.div>
  );
}
