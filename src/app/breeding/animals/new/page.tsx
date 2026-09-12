"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { AnimalForm } from "@/features/breeding/components/AnimalForm";
import { createAnimal } from "@/features/breeding/services/breedingService";
import { generateAnimalCode } from "@/utils/code";
import { db } from "@/lib/db";
import toast from "react-hot-toast";
import type { AnimalFormData } from "@/features/breeding/schemas/breedingSchema";

export default function NewAnimalPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    generateAnimalCode().then(setCode);
  }, []);

  const handleSubmit = async (data: AnimalFormData) => {
    setLoading(true);
    try {
      const species = await db.species.get(data.speciesId);
      const lot = await db.breedingLots.get(data.lotId);
      await createAnimal(data, species?.name || "", lot?.name || "", code);
      toast.success("Animal registrado exitosamente");
      router.push("/breeding");
    } catch {
      toast.error("Error al registrar animal");
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
        <h1 className="text-xl font-bold">Nuevo Animal</h1>
      </div>
      <AnimalForm onSubmit={handleSubmit} loading={loading} code={code} />
    </motion.div>
  );
}
