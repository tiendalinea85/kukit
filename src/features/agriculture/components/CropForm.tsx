"use client";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cropSchema, type CropFormData } from "../schemas/agricultureSchema";
import { CROP_STATUSES } from "../domain/agricultureRules";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

const cropStatusLabels: Record<string, string> = {
  activa: "Activa",
  completada: "Completada",
  cancelada: "Cancelada",
};

interface Props {
  onSubmit: (data: CropFormData) => Promise<void>;
  defaultValues?: Partial<CropFormData>;
  loading?: boolean;
  code?: string;
}

export function CropForm({ onSubmit, defaultValues, loading, code }: Props) {
  const { register, handleSubmit, formState: { errors } } = useForm<CropFormData>({
    resolver: zodResolver(cropSchema) as Resolver<CropFormData>,
    defaultValues: {
      name: defaultValues?.name || "",
      description: defaultValues?.description || "",
      season: defaultValues?.season || "",
      status: defaultValues?.status || "activa",
      startDate: defaultValues?.startDate || new Date().toISOString().split("T")[0],
      endDate: defaultValues?.endDate || "",
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

      <Input label="Nombre del cultivo" {...register("name")} error={errors.name?.message} placeholder="Ej: Maíz amarillo" />

      <Input label="Descripción" {...register("description")} placeholder="Descripción del cultivo (opcional)" />

      <div className="grid grid-cols-2 gap-3">
        <Input label="Temporada" {...register("season")} error={errors.season?.message} placeholder="Ej: Invierno 2026" />
        <Select label="Estado" {...register("status")} error={errors.status?.message}
          options={CROP_STATUSES.map((s) => ({ value: s, label: cropStatusLabels[s] }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Fecha de inicio" type="date" {...register("startDate")} error={errors.startDate?.message} />
        <Input label="Fecha de fin" type="date" {...register("endDate")} />
      </div>

      <Input label="Observaciones" {...register("notes")} placeholder="Notas adicionales (opcional)" />

      <Button type="submit" loading={loading} className="w-full">
        Guardar Cultivo
      </Button>
    </form>
  );
}
