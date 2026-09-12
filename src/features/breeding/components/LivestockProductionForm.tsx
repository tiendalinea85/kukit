"use client";
import { useState, useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { livestockProductionSchema, type LivestockProductionFormData } from "../schemas/breedingSchema";
import { PRODUCTION_TYPES, PRODUCTION_TYPE_LABELS, PRODUCTION_UNITS, computeProductionValue } from "../domain/breedingRules";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { db } from "@/lib/db";
import type { BreedingLot } from "@/types/modules";

interface Props {
  onSubmit: (data: LivestockProductionFormData) => Promise<void>;
  defaultValues?: Partial<LivestockProductionFormData>;
  loading?: boolean;
  code?: string;
}

export function LivestockProductionForm({ onSubmit, defaultValues, loading, code }: Props) {
  const [lots, setLots] = useState<BreedingLot[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    db.breedingLots.toArray().then(setLots);
  }, []);

  const defaultDate = new Date().toISOString().split("T")[0];

  const { register, handleSubmit, watch, formState: { errors } } = useForm<LivestockProductionFormData>({
    resolver: zodResolver(livestockProductionSchema) as Resolver<LivestockProductionFormData>,
    defaultValues: {
      lotId: defaultValues?.lotId || "",
      type: defaultValues?.type ?? "leche",
      quantity: defaultValues?.quantity ?? undefined,
      unit: defaultValues?.unit ?? "litros",
      unitPrice: defaultValues?.unitPrice ?? undefined,
      productionDate: defaultValues?.productionDate || defaultDate,
      notes: defaultValues?.notes || "",
    },
  });

  const quantity = watch("quantity") || 0;
  const unitPrice = watch("unitPrice") || 0;
  const totalValue = computeProductionValue(quantity, unitPrice);

  if (!mounted) return null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {code && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800/40 border border-zinc-700/50">
          <span className="text-xs text-zinc-500">Código:</span>
          <span className="text-sm font-mono text-purple-400">{code}</span>
        </div>
      )}

      <Select
        label="Lote"
        {...register("lotId")}
        error={errors.lotId?.message}
        placeholder="Seleccionar"
        options={lots.map((l) => ({ value: l.id, label: l.name }))}
      />

      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Tipo de Producción"
          {...register("type")}
          error={errors.type?.message}
          options={PRODUCTION_TYPES.map((t) => ({ value: t, label: PRODUCTION_TYPE_LABELS[t] }))}
        />
        <Input label="Fecha de Producción" type="date" {...register("productionDate")} error={errors.productionDate?.message} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Input label="Cantidad" type="number" step="0.01" min="0.01" {...register("quantity")} error={errors.quantity?.message} placeholder="0.00" />
        <Select
          label="Unidad"
          {...register("unit")}
          error={errors.unit?.message}
          options={PRODUCTION_UNITS.map((u) => ({ value: u, label: u }))}
        />
        <Input label="Precio Unitario (S/)" type="number" step="0.01" min="0" {...register("unitPrice")} error={errors.unitPrice?.message} placeholder="0.00" />
      </div>

      <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-purple-600/10 border border-purple-500/30">
        <span className="text-sm text-zinc-400">Valor Total:</span>
        <span className="text-lg font-bold text-purple-400">S/ {totalValue.toFixed(2)}</span>
      </div>

      <Input label="Observaciones" {...register("notes")} placeholder="Notas adicionales (opcional)" />

      <Button type="submit" loading={loading} className="w-full">
        Guardar Producción
      </Button>
    </form>
  );
}
