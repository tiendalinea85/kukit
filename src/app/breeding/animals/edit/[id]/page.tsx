"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { AnimalForm } from "@/features/breeding/components/AnimalForm";
import { updateAnimal } from "@/features/breeding/services/breedingService";
import { db } from "@/lib/db";
import toast from "react-hot-toast";
import type { AnimalFormData } from "@/features/breeding/schemas/breedingSchema";
import type { Animal } from "@/types/modules";

export default function EditAnimalPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    db.animals.get(id).then((a) => a && setAnimal(a));
  }, [id]);

  const handleSubmit = async (data: AnimalFormData) => {
    if (!animal) return;
    setLoading(true);
    try {
      const species = await db.species.get(data.speciesId);
      const lot = await db.breedingLots.get(data.lotId);
      await updateAnimal(animal.id, data, species?.name || "", lot?.name || "");
      toast.success("Animal actualizado");
      router.push("/breeding");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setLoading(false);
    }
  };

  if (!animal) {
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
        <h1 className="text-xl font-bold">Editar Animal</h1>
      </div>

      <AnimalForm
        onSubmit={handleSubmit}
        loading={loading}
        code={animal.code}
        defaultValues={{
          name: animal.name,
          speciesId: animal.speciesId,
          gender: animal.gender,
          birthDate: animal.birthDate,
          lotId: animal.lotId,
          status: animal.status,
          notes: animal.notes,
        }}
      />
    </motion.div>
  );
}
