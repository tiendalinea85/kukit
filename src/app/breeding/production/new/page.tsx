"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { LivestockProductionForm } from "@/features/breeding/components/LivestockProductionForm";
import { createLivestockProduction } from "@/features/breeding/services/breedingService";
import { generateLivestockProductionCode } from "@/utils/code";
import { db } from "@/lib/db";
import toast from "react-hot-toast";
import type { LivestockProductionFormData } from "@/features/breeding/schemas/breedingSchema";

export default function NewProductionPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    generateLivestockProductionCode().then(setCode);
  }, []);

  const handleSubmit = async (data: LivestockProductionFormData) => {
    setLoading(true);
    try {
      const lot = await db.breedingLots.get(data.lotId);
      await createLivestockProduction(data, lot?.name || "", code);
      toast.success("Producción registrada exitosamente");
      router.push("/breeding");
    } catch {
      toast.error("Error al registrar producción");
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
        <h1 className="text-xl font-bold">Nueva Producción</h1>
      </div>
      <LivestockProductionForm onSubmit={handleSubmit} loading={loading} code={code} />
    </motion.div>
  );
}
