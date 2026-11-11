"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Lock } from "lucide-react";
import { MaterialForm } from "@/features/tailoring/components/MaterialForm";
import { updateMaterial } from "@/features/tailoring/services/tailoringService";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";
import type { MaterialFormData } from "@/features/tailoring/schemas/tailoringSchema";
import type { Material } from "@/types/modules";

export default function EditMaterialPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    db.materials.get(id).then((m) => setMaterial(m ?? null));
  }, [id]);

  const handleSubmit = async (data: MaterialFormData) => {
    if (!material) return;
    setLoading(true);
    try {
      await updateMaterial(material.id, data);
      toast.success("Material actualizado");
      router.push("/tailoring");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setLoading(false);
    }
  };

  if (!material) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (material.deleted) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold">Editar Material</h1>
        </div>
        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-8 text-center space-y-3">
          <Lock size={28} className="mx-auto text-zinc-600" />
          <p className="text-zinc-300 font-medium">Este material no puede editarse</p>
          <p className="text-sm text-zinc-500">Fue eliminado.</p>
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
        <h1 className="text-xl font-bold">Editar Material</h1>
      </div>

      <MaterialForm
        onSubmit={handleSubmit}
        loading={loading}
        code={material.code}
        defaultValues={{
          name: material.name,
          // El dominio guarda la unidad como string libre; el formulario la
          // valida contra el catálogo (MATERIAL_UNITS).
          unit: material.unit as MaterialFormData["unit"],
          costPerUnit: material.costPerUnit,
          stock: material.stock,
          notes: material.notes,
        }}
      />
    </motion.div>
  );
}
