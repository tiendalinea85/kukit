"use client";
import { useState, useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { feedingSchema, type FeedingFormData } from "../schemas/breedingSchema";
import { FEED_TYPES, FEED_TYPE_LABELS, FEEDING_UNITS } from "../domain/breedingRules";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { db } from "@/lib/db";
import type { BreedingLot } from "@/types/modules";

interface Props {
  onSubmit: (data: FeedingFormData) => Promise<void>;
  defaultValues?: Partial<FeedingFormData>;
  loading?: boolean;
  code?: string;
}

export function FeedingForm({ onSubmit, defaultValues, loading, code }: Props) {
  const [lots, setLots] = useState<BreedingLot[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    db.breedingLots.toArray().then(setLots);
  }, []);

  const defaultDate = new Date().toISOString().split("T")[0];

  const { register, handleSubmit, formState: { errors } } = useForm<FeedingFormData>({
    resolver: zodResolver(feedingSchema) as Resolver<FeedingFormData>,
    defaultValues: {
      lotId: defaultValues?.lotId || "",
      feedType: defaultValues?.feedType ?? "concentrado",
      feedName: defaultValues?.feedName || "",
      quantity: defaultValues?.quantity ?? undefined,
      unit: defaultValues?.unit ?? "kg",
      cost: defaultValues?.cost ?? undefined,
      feedingDate: defaultValues?.feedingDate || defaultDate,
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

      <Select
        label="Lote"
        {...register("lotId")}
        error={errors.lotId?.message}
        placeholder="Seleccionar"
        options={lots.map((l) => ({ value: l.id, label: l.name }))}
      />

      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Tipo de Alimento"
          {...register("feedType")}
          error={errors.feedType?.message}
          options={FEED_TYPES.map((t) => ({ value: t, label: FEED_TYPE_LABELS[t] }))}
        />
        <Input label="Nombre del Alimento" {...register("feedName")} error={errors.feedName?.message} placeholder="Ej: Balanceado Premium" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Input label="Cantidad" type="number" step="0.01" min="0.01" {...register("quantity")} error={errors.quantity?.message} placeholder="0.00" />
        <Select
          label="Unidad"
          {...register("unit")}
          error={errors.unit?.message}
          options={FEEDING_UNITS.map((u) => ({ value: u, label: u }))}
        />
        <Input label="Costo (S/)" type="number" step="0.01" min="0" {...register("cost")} error={errors.cost?.message} placeholder="0.00" />
      </div>

      <Input label="Fecha de Alimentación" type="date" {...register("feedingDate")} error={errors.feedingDate?.message} />

      <Input label="Observaciones" {...register("notes")} placeholder="Notas adicionales (opcional)" />

      <Button type="submit" loading={loading} className="w-full">
        Guardar Alimentación
      </Button>
    </form>
  );
}
