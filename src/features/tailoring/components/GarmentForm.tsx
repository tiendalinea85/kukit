"use client";
import { useState, useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { garmentSchema, type GarmentFormData } from "../schemas/tailoringSchema";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { db } from "@/lib/db";
import type { Category } from "@/types";

interface Props {
  onSubmit: (data: GarmentFormData) => Promise<void>;
  defaultValues?: Partial<GarmentFormData>;
  loading?: boolean;
  code?: string;
}

export function GarmentForm({ onSubmit, defaultValues, loading, code }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    db.categories.toArray().then(setCategories);
  }, []);

  const { register, handleSubmit, formState: { errors } } = useForm<GarmentFormData>({
    resolver: zodResolver(garmentSchema) as Resolver<GarmentFormData>,
    defaultValues: {
      name: defaultValues?.name || "",
      description: defaultValues?.description || "",
      categoryId: defaultValues?.categoryId || "",
      salePrice: defaultValues?.salePrice ?? undefined,
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

      <Input label="Nombre" {...register("name")} error={errors.name?.message} placeholder="Ej: Camisa Clásica" />

      <Input label="Descripción" {...register("description")} placeholder="Descripción de la prenda (opcional)" />

      <div className="grid grid-cols-2 gap-3">
        <Select label="Categoría" {...register("categoryId")} error={errors.categoryId?.message}
          placeholder="Seleccionar"
          options={categories.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))}
        />
        <Input label="Precio de Venta" type="number" step="0.01" min="0" {...register("salePrice")} error={errors.salePrice?.message} placeholder="0.00" />
      </div>

      <Input label="Observaciones" {...register("notes")} placeholder="Notas adicionales (opcional)" />

      <Button type="submit" loading={loading} className="w-full">
        Guardar Prenda
      </Button>
    </form>
  );
}
