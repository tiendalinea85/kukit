"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { CompatibilityForm } from "@/features/autoparts/components/CompatibilityForm";
import { createPartCompatibility } from "@/features/autoparts/services/autopartsService";
import toast from "react-hot-toast";
import type { PartCompatibilityFormData } from "@/features/autoparts/schemas/autopartsSchema";

export default function NewCompatibilityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data: PartCompatibilityFormData) => {
    setLoading(true);
    try {
      await createPartCompatibility(data);
      toast.success("Compatibilidad registrada exitosamente");
      router.push("/autoparts");
    } catch {
      toast.error("Error al registrar compatibilidad");
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
        <h1 className="text-xl font-bold">Nueva Compatibilidad</h1>
      </div>
      <CompatibilityForm onSubmit={handleSubmit} loading={loading} />
    </motion.div>
  );
}
