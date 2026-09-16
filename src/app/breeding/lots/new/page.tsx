"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { breedingLotSchema, type BreedingLotFormData } from "@/features/breeding/schemas/breedingSchema";
import { createBreedingLot } from "@/features/breeding/services/breedingService";
import { generateBreedingLotCode } from "@/utils/code";
import { useSpecies } from "@/features/breeding/hooks/useBreeding";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import toast from "react-hot-toast";

export default function NewLotPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { species } = useSpecies();

  useEffect(() => {
    generateBreedingLotCode().then(setCode);
  }, []);

  const { register, handleSubmit, formState: { errors } } = useForm<BreedingLotFormData>({
    resolver: zodResolver(breedingLotSchema) as Resolver<BreedingLotFormData>,
    defaultValues: {
      name: "",
      speciesId: "",
      location: "",
      capacity: undefined,
      notes: "",
    },
  });

  const onSubmit = async (data: BreedingLotFormData) => {
    setLoading(true);
    try {
      await createBreedingLot(data, code);
      toast.success("Lote creado exitosamente");
      router.push("/breeding");
    } catch {
      toast.error("Error al crear lote");
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
        <h1 className="text-xl font-bold">Nuevo Lote</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {code && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800/40 border border-zinc-700/50">
            <span className="text-xs text-zinc-500">Código:</span>
            <span className="text-sm font-mono text-purple-400">{code}</span>
          </div>
        )}

        <Input label="Nombre" {...register("name")} error={errors.name?.message} placeholder="Ej: Lote Norte, Corral 1" />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Especie"
            {...register("speciesId")}
            error={errors.speciesId?.message}
            placeholder="Seleccionar"
            options={species.map((s) => ({ value: s.id, label: s.name }))}
          />
          <Input label="Capacidad" type="number" min="1" {...register("capacity")} error={errors.capacity?.message} placeholder="0" />
        </div>

        <Input label="Ubicación" {...register("location")} error={errors.location?.message} placeholder="Ej: Campo sur, Galpón A" />

        <Input label="Observaciones" {...register("notes")} placeholder="Notas (opcional)" />

        <Button type="submit" loading={loading} className="w-full">
          Crear Lote
        </Button>
      </form>
    </motion.div>
  );
}
