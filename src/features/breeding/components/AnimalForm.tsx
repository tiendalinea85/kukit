"use client";
import { useState, useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { animalSchema, type AnimalFormData } from "../schemas/breedingSchema";
import { ANIMAL_STATUSES, ANIMAL_GENDERS, ANIMAL_STATUS_LABELS, ANIMAL_GENDER_LABELS } from "../domain/breedingRules";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { db } from "@/lib/db";
import type { Species, BreedingLot } from "@/types/modules";

interface Props {
  onSubmit: (data: AnimalFormData) => Promise<void>;
  defaultValues?: Partial<AnimalFormData>;
  loading?: boolean;
  code?: string;
}

export function AnimalForm({ onSubmit, defaultValues, loading, code }: Props) {
  const [speciesList, setSpeciesList] = useState<Species[]>([]);
  const [lots, setLots] = useState<BreedingLot[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    db.species.toArray().then(setSpeciesList);
    db.breedingLots.toArray().then(setLots);
  }, []);

  const defaultDate = new Date().toISOString().split("T")[0];

  const { register, handleSubmit, formState: { errors } } = useForm<AnimalFormData>({
    resolver: zodResolver(animalSchema) as Resolver<AnimalFormData>,
    defaultValues: {
      name: defaultValues?.name || "",
      speciesId: defaultValues?.speciesId || "",
      gender: defaultValues?.gender ?? "macho",
      birthDate: defaultValues?.birthDate || defaultDate,
      lotId: defaultValues?.lotId || "",
      status: defaultValues?.status || "activo",
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

      <Input label="Nombre" {...register("name")} error={errors.name?.message} placeholder="Ej: Vaca #23" />

      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Especie"
          {...register("speciesId")}
          error={errors.speciesId?.message}
          placeholder="Seleccionar"
          options={speciesList.map((s) => ({ value: s.id, label: s.name }))}
        />
        <Select
          label="Género"
          {...register("gender")}
          error={errors.gender?.message}
          options={ANIMAL_GENDERS.map((g) => ({ value: g, label: ANIMAL_GENDER_LABELS[g] }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Fecha de Nacimiento" type="date" {...register("birthDate")} error={errors.birthDate?.message} />
        <Select
          label="Lote"
          {...register("lotId")}
          error={errors.lotId?.message}
          placeholder="Seleccionar"
          options={lots.map((l) => ({ value: l.id, label: l.name }))}
        />
      </div>

      <Select
        label="Estado"
        {...register("status")}
        options={ANIMAL_STATUSES.map((s) => ({ value: s, label: ANIMAL_STATUS_LABELS[s] }))}
      />

      <Input label="Observaciones" {...register("notes")} placeholder="Notas adicionales (opcional)" />

      <Button type="submit" loading={loading} className="w-full">
        Guardar Animal
      </Button>
    </form>
  );
}
