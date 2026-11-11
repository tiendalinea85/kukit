"use client";
import { useState, useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { materialSchema, type MaterialFormData } from "../schemas/tailoringSchema";
import { MATERIAL_UNITS } from "../domain/tailoringRules";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

interface Props {
  onSubmit: (data: MaterialFormData) => Promise<void>;
  defaultValues?: Partial<MaterialFormData>;
  loading?: boolean;
  code?: string;
}

export function MaterialForm({ onSubmit, defaultValues, loading, code }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const { register, handleSubmit, formState: { errors } } = useForm<MaterialFormData>({
    resolver: zodResolver(materialSchema) as Resolver<MaterialFormData>,
    defaultValues: {
      name: defaultValues?.name || "",
      unit: defaultValues?.unit || undefined,
      costPerUnit: defaultValues?.costPerUnit ?? undefined,
      stock: defaultValues?.stock ?? undefined,
      notes: defaultValues?.notes || "",
    },
  });

  if (!mounted) return null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {code && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800/40 border border-zinc-700/50">
          <span className="text-xs text-zinc-500">Código:</span>
          <span className="text-sm font-mono text-purple-400">{code}</span>
        </div>
      )}

      <Input label="Nombre" {...register("name")} error={errors.name?.message} placeholder="Ej: Tela de algodón" />

      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Unidad"
          {...register("unit")}
          error={errors.unit?.message}
          placeholder="Seleccionar"
          options={MATERIAL_UNITS.map((u) => ({ value: u, label: u }))}
        />
        <Input
          label="Costo por Unidad"
          type="number"
          step="0.01"
          min="0"
          {...register("costPerUnit")}
          error={errors.costPerUnit?.message}
          placeholder="0.00"
        />
      </div>

      <Input
        label="Stock"
        type="number"
        step="0.01"
        min="0"
        {...register("stock")}
        error={errors.stock?.message}
        placeholder="0"
      />

      <Input label="Observaciones" {...register("notes")} placeholder="Notas adicionales (opcional)" />

      <Button type="submit" loading={loading} className="w-full">
        Guardar Material
      </Button>
    </form>
  );
}
