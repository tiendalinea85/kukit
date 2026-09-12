"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { farmLotSchema, type FarmLotFormData } from "@/features/agriculture/schemas/agricultureSchema";
import { createFarmLot } from "@/features/agriculture/services/agricultureService";
import { generateLotCode } from "@/utils/code";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import toast from "react-hot-toast";

export default function NewFarmLotPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FarmLotFormData>({
    resolver: zodResolver(farmLotSchema),
    defaultValues: {
      name: "",
      area: undefined,
      areaUnit: "hectáreas",
      location: "",
      soilType: "",
      notes: "",
    },
  });

  useEffect(() => {
    generateLotCode().then(setCode);
  }, []);

  const onSubmit = async (data: FarmLotFormData) => {
    setLoading(true);
    try {
      await createFarmLot(data, code);
      toast.success("Lote registrado exitosamente");
      router.push("/agriculture");
    } catch {
      toast.error("Error al registrar lote");
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

        <Input label="Nombre del lote" {...register("name")} error={errors.name?.message} placeholder="Ej: Lote Norte" />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Área" type="number" step="0.01" min="0.01" {...register("area")} error={errors.area?.message} placeholder="0" />
          <Input label="Unidad de área" {...register("areaUnit")} error={errors.areaUnit?.message} placeholder="Ej: hectáreas" />
        </div>

        <Input label="Ubicación" {...register("location")} placeholder="Ej: Valle de Cauca (opcional)" />
        <Input label="Tipo de suelo" {...register("soilType")} placeholder="Ej: Franco arcilloso (opcional)" />
        <Input label="Observaciones" {...register("notes")} placeholder="Notas adicionales (opcional)" />

        <Button type="submit" loading={loading} className="w-full">
          Guardar Lote
        </Button>
      </form>
    </motion.div>
  );
}
