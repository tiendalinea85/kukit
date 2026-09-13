"use client";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { autoPartSchema, type AutoPartFormData } from "../schemas/autopartsSchema";
import { PART_CATEGORIES } from "../domain/autopartsRules";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

interface Props {
  onSubmit: (data: AutoPartFormData) => Promise<void>;
  defaultValues?: Partial<AutoPartFormData>;
  loading?: boolean;
  code?: string;
}

export function AutoPartForm({ onSubmit, defaultValues, loading, code }: Props) {
  const { register, handleSubmit, formState: { errors } } = useForm<AutoPartFormData>({
    resolver: zodResolver(autoPartSchema) as Resolver<AutoPartFormData>,
    defaultValues: {
      name: defaultValues?.name || "",
      partNumber: defaultValues?.partNumber || "",
      brand: defaultValues?.brand || "",
      category: defaultValues?.category || "",
      unitPrice: defaultValues?.unitPrice ?? 0,
      costPrice: defaultValues?.costPrice ?? 0,
      stock: defaultValues?.stock ?? 0,
      minStock: defaultValues?.minStock ?? 0,
      notes: defaultValues?.notes || "",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {code && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800/40 border border-zinc-700/50">
          <span className="text-xs text-zinc-500">Código:</span>
          <span className="text-sm font-mono text-purple-400">{code}</span>
        </div>
      )}

      <Input label="Nombre del repuesto" {...register("name")} error={errors.name?.message} placeholder="Ej: Pastillas de freno delanteras" />

      <div className="grid grid-cols-2 gap-3">
        <Input label="Número de parte" {...register("partNumber")} error={errors.partNumber?.message} placeholder="Ej: FP-2024-A" />
        <Input label="Marca" {...register("brand")} error={errors.brand?.message} placeholder="Ej: Bosch" />
      </div>

      <Select label="Categoría" {...register("category")} error={errors.category?.message} placeholder="Seleccionar"
        options={PART_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input label="Precio de costo" type="number" step="0.01" min="0" {...register("costPrice")} error={errors.costPrice?.message} placeholder="0.00" />
        <Input label="Precio de venta" type="number" step="0.01" min="0" {...register("unitPrice")} error={errors.unitPrice?.message} placeholder="0.00" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Stock actual" type="number" min="0" {...register("stock")} error={errors.stock?.message} placeholder="0" />
        <Input label="Stock mínimo" type="number" min="0" {...register("minStock")} error={errors.minStock?.message} placeholder="0" />
      </div>

      <Input label="Observaciones" {...register("notes")} placeholder="Notas adicionales (opcional)" />

      <Button type="submit" loading={loading} className="w-full">
        Guardar Repuesto
      </Button>
    </form>
  );
}
