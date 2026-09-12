"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { HarvestForm } from "@/features/agriculture/components/HarvestForm";
import { createHarvest } from "@/features/agriculture/services/agricultureService";
import { generateHarvestCode } from "@/utils/code";
import { useCrops, useFarmLots } from "@/features/agriculture/hooks/useAgriculture";
import toast from "react-hot-toast";
import type { HarvestFormData } from "@/features/agriculture/schemas/agricultureSchema";

export default function NewHarvestPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { crops } = useCrops();
  const { farmLots } = useFarmLots();

  useEffect(() => {
    generateHarvestCode().then(setCode);
  }, []);

  const handleSubmit = async (data: HarvestFormData) => {
    setLoading(true);
    try {
      await createHarvest(data, crops, farmLots, code);
      toast.success("Cosecha registrada exitosamente");
      router.push("/agriculture");
    } catch {
      toast.error("Error al registrar cosecha");
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
        <h1 className="text-xl font-bold">Nueva Cosecha</h1>
      </div>
      <HarvestForm onSubmit={handleSubmit} loading={loading} code={code} />
    </motion.div>
  );
}
