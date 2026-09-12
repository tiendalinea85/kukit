"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { AutoPartForm } from "@/features/autoparts/components/AutoPartForm";
import { createAutoPart } from "@/features/autoparts/services/autopartsService";
import toast from "react-hot-toast";
import type { AutoPartFormData } from "@/features/autoparts/schemas/autopartsSchema";

export default function NewAutoPartPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data: AutoPartFormData) => {
    setLoading(true);
    try {
      await createAutoPart(data);
      toast.success("Repuesto registrado exitosamente");
      router.push("/autoparts");
    } catch {
      toast.error("Error al registrar repuesto");
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
        <h1 className="text-xl font-bold">Nuevo Repuesto</h1>
      </div>
      <AutoPartForm onSubmit={handleSubmit} loading={loading} />
    </motion.div>
  );
}
