"use client";
import { useState, useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { reproductionSchema, type ReproductionFormData } from "../schemas/breedingSchema";
import { REPRO_EVENTS, REPRO_EVENT_LABELS } from "../domain/breedingRules";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { db } from "@/lib/db";
import type { Animal } from "@/types/modules";

interface Props {
  onSubmit: (data: ReproductionFormData) => Promise<void>;
  defaultValues?: Partial<ReproductionFormData>;
  loading?: boolean;
  code?: string;
}

export function ReproductionForm({ onSubmit, defaultValues, loading, code }: Props) {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    db.animals.where("status").equals("activo").toArray().then(setAnimals);
  }, []);

  const defaultDate = new Date().toISOString().split("T")[0];

  const { register, handleSubmit, formState: { errors } } = useForm<ReproductionFormData>({
    resolver: zodResolver(reproductionSchema) as Resolver<ReproductionFormData>,
    defaultValues: {
      animalId: defaultValues?.animalId || "",
      event: defaultValues?.event ?? "monta",
      eventDate: defaultValues?.eventDate || defaultDate,
      targetAnimal: defaultValues?.targetAnimal || "",
      result: defaultValues?.result || "",
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
        label="Animal"
        {...register("animalId")}
        error={errors.animalId?.message}
        placeholder="Seleccionar"
        options={animals.map((a) => ({ value: a.id, label: `${a.code} - ${a.name}` }))}
      />

      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Evento Reproductivo"
          {...register("event")}
          error={errors.event?.message}
          options={REPRO_EVENTS.map((e) => ({ value: e, label: REPRO_EVENT_LABELS[e] }))}
        />
        <Input label="Fecha del Evento" type="date" {...register("eventDate")} error={errors.eventDate?.message} />
      </div>

      <Input label="Animal Objetivo" {...register("targetAnimal")} placeholder="Ej: Toro #5 (opcional)" />

      <Input label="Resultado" {...register("result")} placeholder="Ej: Gestación confirmada (opcional)" />

      <Input label="Observaciones" {...register("notes")} placeholder="Notas adicionales (opcional)" />

      <Button type="submit" loading={loading} className="w-full">
        Guardar Reproducción
      </Button>
    </form>
  );
}
