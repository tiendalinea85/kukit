"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { MaterialForm } from "@/features/tailoring/components/MaterialForm";
import { createMaterial } from "@/features/tailoring/services/tailoringService";
import { generateMaterialCode } from "@/utils/code";
import toast from "react-hot-toast";
import type { MaterialFormData } from "@/features/tailoring/schemas/tailoringSchema";

export default function NewMaterialPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    generateMaterialCode().then(setCode);
  }, []);

  const handleSubmit = async (data: MaterialFormData) => {
    setLoading(true);
    try {
      await createMaterial(data, code);
      toast.success("Material creado exitosamente");
      router.push("/tailoring");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear material");
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
        <h1 className="text-xl font-bold">Nuevo Material</h1>
      </div>
      <MaterialForm onSubmit={handleSubmit} loading={loading} code={code} />
    </motion.div>
  );
}
