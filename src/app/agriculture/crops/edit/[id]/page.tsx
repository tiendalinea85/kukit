"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { CropForm } from "@/features/agriculture/components/CropForm";
import { updateCrop } from "@/features/agriculture/services/agricultureService";
import { canEditCrop } from "@/features/agriculture/domain/agricultureRules";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";
import type { CropFormData } from "@/features/agriculture/schemas/agricultureSchema";
import type { Crop } from "@/types/modules";

export default function EditCropPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [crop, setCrop] = useState<Crop | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    db.crops.get(id).then((c) => c && setCrop(c));
  }, [id]);

  const handleSubmit = async (data: CropFormData) => {
    if (!crop) return;
    setLoading(true);
    try {
      await updateCrop(crop.id, data);
      toast.success("Cultivo actualizado");
      router.push("/agriculture");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setLoading(false);
    }
  };

  if (!crop) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!canEditCrop(crop)) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold">Editar Cultivo</h1>
        </div>
        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-8 text-center space-y-3">
          <p className="text-zinc-300 font-medium">Este cultivo no está activo</p>
          <p className="text-sm text-zinc-500">Solo se pueden editar cultivos con estado &quot;activa&quot;.</p>
          <Button variant="secondary" className="mx-auto" onClick={() => router.push("/agriculture")}>
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
        <h1 className="text-xl font-bold">Editar Cultivo</h1>
      </div>
      <CropForm
        onSubmit={handleSubmit}
        loading={loading}
        code={crop.code}
        defaultValues={{
          name: crop.name,
          description: crop.description,
          season: crop.season,
          status: crop.status,
          startDate: crop.startDate,
          endDate: crop.endDate || "",
          notes: crop.notes,
        }}
      />
    </motion.div>
  );
}
