"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { ApplicationForm } from "@/features/agriculture/components/ApplicationForm";
import { createApplication } from "@/features/agriculture/services/agricultureService";
import { generateApplicationCode } from "@/utils/code";
import { useCrops, useFarmLots, useAgroInputs } from "@/features/agriculture/hooks/useAgriculture";
import toast from "react-hot-toast";
import type { ApplicationFormData } from "@/features/agriculture/schemas/agricultureSchema";

export default function NewApplicationPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { crops } = useCrops();
  const { farmLots } = useFarmLots();
  const { agroInputs } = useAgroInputs();

  useEffect(() => {
    generateApplicationCode().then(setCode);
  }, []);

  const handleSubmit = async (data: ApplicationFormData) => {
    setLoading(true);
    try {
      await createApplication(data, crops, farmLots, agroInputs, code);
      toast.success("Aplicación registrada exitosamente");
      router.push("/agriculture");
    } catch {
      toast.error("Error al registrar aplicación");
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
        <h1 className="text-xl font-bold">Nueva Aplicación</h1>
      </div>
      <ApplicationForm onSubmit={handleSubmit} loading={loading} code={code} />
    </motion.div>
  );
}
