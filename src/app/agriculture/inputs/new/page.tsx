"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { agroInputSchema, type AgroInputFormData } from "@/features/agriculture/schemas/agricultureSchema";
import { createAgroInput } from "@/features/agriculture/services/agricultureService";
import { AGRO_INPUT_TYPES } from "@/features/agriculture/domain/agricultureRules";
import { generateAgroInputCode } from "@/utils/code";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import toast from "react-hot-toast";

const inputTypeLabels: Record<string, string> = {
  fertilizante: "Fertilizante",
  pesticida: "Pesticida",
  herbicida: "Herbicida",
  semilla: "Semilla",
  otro: "Otro",
};

export default function NewAgroInputPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<AgroInputFormData>({
    resolver: zodResolver(agroInputSchema),
    defaultValues: {
      name: "",
      type: "fertilizante",
      unit: "",
      costPerUnit: undefined,
      stock: undefined,
      supplier: "",
      notes: "",
    },
  });

  useEffect(() => {
    generateAgroInputCode().then(setCode);
  }, []);

  const onSubmit = async (data: AgroInputFormData) => {
    setLoading(true);
    try {
      await createAgroInput(data, code);
      toast.success("Insumo registrado exitosamente");
      router.push("/agriculture");
    } catch {
      toast.error("Error al registrar insumo");
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
        <h1 className="text-xl font-bold">Nuevo Insumo</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {code && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800/40 border border-zinc-700/50">
            <span className="text-xs text-zinc-500">Código:</span>
            <span className="text-sm font-mono text-purple-400">{code}</span>
          </div>
        )}

        <Input label="Nombre del insumo" {...register("name")} error={errors.name?.message} placeholder="Ej: Urea agrícola" />

        <Select label="Tipo de insumo" {...register("type")} error={errors.type?.message}
          options={AGRO_INPUT_TYPES.map((t) => ({ value: t, label: inputTypeLabels[t] }))}
        />

        <div className="grid grid-cols-3 gap-3">
          <Input label="Unidad" {...register("unit")} error={errors.unit?.message} placeholder="Ej: kg" />
          <Input label="Costo por unidad" type="number" step="0.01" min="0" {...register("costPerUnit")} error={errors.costPerUnit?.message} placeholder="0.00" />
          <Input label="Stock" type="number" step="0.01" min="0" {...register("stock")} error={errors.stock?.message} placeholder="0" />
        </div>

        <Input label="Proveedor" {...register("supplier")} placeholder="Nombre del proveedor (opcional)" />
        <Input label="Observaciones" {...register("notes")} placeholder="Notas adicionales (opcional)" />

        <Button type="submit" loading={loading} className="w-full">
          Guardar Insumo
        </Button>
      </form>
    </motion.div>
  );
}
