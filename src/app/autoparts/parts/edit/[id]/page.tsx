"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { AutoPartForm } from "@/features/autoparts/components/AutoPartForm";
import { updateAutoPart } from "@/features/autoparts/services/autopartsService";
import { db } from "@/lib/db";
import toast from "react-hot-toast";
import type { AutoPartFormData } from "@/features/autoparts/schemas/autopartsSchema";
import type { AutoPart } from "@/types/modules";

export default function EditAutoPartPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [part, setPart] = useState<AutoPart | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    db.autoParts.get(id).then((p) => p && setPart(p));
  }, [id]);

  const handleSubmit = async (data: AutoPartFormData) => {
    if (!part) return;
    setLoading(true);
    try {
      await updateAutoPart(part.id, data);
      toast.success("Repuesto actualizado");
      router.push("/autoparts");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setLoading(false);
    }
  };

  if (!part) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">Editar Repuesto</h1>
      </div>

      <AutoPartForm
        onSubmit={handleSubmit}
        loading={loading}
        code={part.code}
        defaultValues={{
          name: part.name,
          partNumber: part.partNumber,
          brand: part.brand,
          category: part.category,
          unitPrice: part.unitPrice,
          costPrice: part.costPrice,
          stock: part.stock,
          minStock: part.minStock,
          notes: part.notes,
        }}
      />
    </motion.div>
  );
}
