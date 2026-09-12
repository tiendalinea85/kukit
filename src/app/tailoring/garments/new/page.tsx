"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { GarmentForm } from "@/features/tailoring/components/GarmentForm";
import { createGarment } from "@/features/tailoring/services/tailoringService";
import { generateGarmentCode } from "@/utils/code";
import toast from "react-hot-toast";
import type { GarmentFormData } from "@/features/tailoring/schemas/tailoringSchema";

export default function NewGarmentPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    generateGarmentCode().then(setCode);
  }, []);

  const handleSubmit = async (data: GarmentFormData) => {
    setLoading(true);
    try {
      await createGarment(data, code);
      toast.success("Prenda creada exitosamente");
      router.push("/tailoring");
    } catch {
      toast.error("Error al crear prenda");
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
        <h1 className="text-xl font-bold">Nueva Prenda</h1>
      </div>
      <GarmentForm onSubmit={handleSubmit} loading={loading} code={code} />
    </motion.div>
  );
}
