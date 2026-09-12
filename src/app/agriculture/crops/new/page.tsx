"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { CropForm } from "@/features/agriculture/components/CropForm";
import { createCrop } from "@/features/agriculture/services/agricultureService";
import { generateCropCode } from "@/utils/code";
import toast from "react-hot-toast";
import type { CropFormData } from "@/features/agriculture/schemas/agricultureSchema";

export default function NewCropPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    generateCropCode().then(setCode);
  }, []);

  const handleSubmit = async (data: CropFormData) => {
    setLoading(true);
    try {
      await createCrop(data, code);
      toast.success("Cultivo registrado exitosamente");
      router.push("/agriculture");
    } catch {
      toast.error("Error al registrar cultivo");
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
        <h1 className="text-xl font-bold">Nuevo Cultivo</h1>
      </div>
      <CropForm onSubmit={handleSubmit} loading={loading} code={code} />
    </motion.div>
  );
}
