"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { ReproductionForm } from "@/features/breeding/components/ReproductionForm";
import { createReproduction } from "@/features/breeding/services/breedingService";
import { generateReproductionCode } from "@/utils/code";
import { db } from "@/lib/db";
import toast from "react-hot-toast";
import type { ReproductionFormData } from "@/features/breeding/schemas/breedingSchema";

export default function NewReproductionPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    generateReproductionCode().then(setCode);
  }, []);

  const handleSubmit = async (data: ReproductionFormData) => {
    setLoading(true);
    try {
      const animal = await db.animals.get(data.animalId);
      await createReproduction(data, animal?.name || "", code);
      toast.success("Reproducción registrada exitosamente");
      router.push("/breeding");
    } catch {
      toast.error("Error al registrar reproducción");
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
        <h1 className="text-xl font-bold">Nueva Reproducción</h1>
      </div>
      <ReproductionForm onSubmit={handleSubmit} loading={loading} code={code} />
    </motion.div>
  );
}
