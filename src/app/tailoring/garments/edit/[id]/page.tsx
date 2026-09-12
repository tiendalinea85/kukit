"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { GarmentForm } from "@/features/tailoring/components/GarmentForm";
import { updateGarment } from "@/features/tailoring/services/tailoringService";
import { canEditGarment } from "@/features/tailoring/domain/tailoringRules";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";
import type { GarmentFormData } from "@/features/tailoring/schemas/tailoringSchema";
import type { Garment } from "@/types/modules";

export default function EditGarmentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [garment, setGarment] = useState<Garment | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    db.garments.get(id).then((g) => g && setGarment(g));
  }, [id]);

  const handleSubmit = async (data: GarmentFormData) => {
    if (!garment) return;
    setLoading(true);
    try {
      await updateGarment(garment.id, data);
      toast.success("Prenda actualizada");
      router.push("/tailoring");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setLoading(false);
    }
  };

  if (!garment) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!canEditGarment(garment)) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold">Editar Prenda</h1>
        </div>
        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-8 text-center space-y-3">
          <p className="text-zinc-300 font-medium">Esta prenda no puede editarse</p>
          <Button variant="secondary" className="mx-auto" onClick={() => router.push("/tailoring")}>
            Volver
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">Editar Prenda</h1>
      </div>

      <GarmentForm
        onSubmit={handleSubmit}
        loading={loading}
        code={garment.code}
        defaultValues={{
          name: garment.name,
          description: garment.description,
          categoryId: garment.categoryId,
          salePrice: garment.salePrice,
          notes: garment.notes,
        }}
      />
    </motion.div>
  );
}
