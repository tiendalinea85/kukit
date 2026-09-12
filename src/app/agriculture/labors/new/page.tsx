"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { LaborForm } from "@/features/agriculture/components/LaborForm";
import { createLabor } from "@/features/agriculture/services/agricultureService";
import { generateLaborCode } from "@/utils/code";
import { useCrops, useFarmLots } from "@/features/agriculture/hooks/useAgriculture";
import toast from "react-hot-toast";
import type { LaborFormData } from "@/features/agriculture/schemas/agricultureSchema";

export default function NewLaborPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { crops } = useCrops();
  const { farmLots } = useFarmLots();

  useEffect(() => {
    generateLaborCode().then(setCode);
  }, []);

  const handleSubmit = async (data: LaborFormData) => {
    setLoading(true);
    try {
      await createLabor(data, crops, farmLots, code);
      toast.success("Labor registrada exitosamente");
      router.push("/agriculture");
    } catch {
      toast.error("Error al registrar labor");
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
        <h1 className="text-xl font-bold">Nueva Labor</h1>
      </div>
      <LaborForm onSubmit={handleSubmit} loading={loading} code={code} />
    </motion.div>
  );
}
