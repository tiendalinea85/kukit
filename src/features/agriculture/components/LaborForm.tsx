"use client";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { laborSchema, type LaborFormData } from "../schemas/agricultureSchema";
import { LABOR_TYPES } from "../domain/agricultureRules";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import type { Crop, FarmLot } from "@/types/modules";

const laborTypeLabels: Record<string, string> = {
  siembra: "Siembra",
  fumigacion: "Fumigación",
  fertilizacion: "Fertilización",
  "control_de_plagas": "Control de Plagas",
  cosecha: "Cosecha",
  riego: "Riego",
  podar: "Podar",
  otro: "Otro",
};

interface Props {
  onSubmit: (data: LaborFormData) => Promise<void>;
  defaultValues?: Partial<LaborFormData>;
  loading?: boolean;
  code?: string;
}

export function LaborForm({ onSubmit, defaultValues, loading, code }: Props) {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [farmLots, setFarmLots] = useState<FarmLot[]>([]);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const { register, handleSubmit, formState: { errors } } = useForm<LaborFormData>({
    resolver: zodResolver(laborSchema),
    defaultValues: {
      cropId: defaultValues?.cropId || "",
      lotId: defaultValues?.lotId || "",
      type: defaultValues?.type || "siembra",
      description: defaultValues?.description || "",
      laborDate: defaultValues?.laborDate || new Date().toISOString().split("T")[0],
      laborCost: defaultValues?.laborCost ?? undefined,
      workerCount: defaultValues?.workerCount ?? undefined,
      notes: defaultValues?.notes || "",
    },
  });

  useEffect(() => {
    if (!activeWorkspaceId) return;
    db.crops.where("workspaceId").equals(activeWorkspaceId).filter((c) => c.deleted !== true).toArray().then(setCrops);
    db.farmLots.where("workspaceId").equals(activeWorkspaceId).filter((l) => l.deleted !== true).toArray().then(setFarmLots);
  }, [activeWorkspaceId]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {code && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800/40 border border-zinc-700/50">
          <span className="text-xs text-zinc-500">Código:</span>
          <span className="text-sm font-mono text-purple-400">{code}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Select label="Cultivo" {...register("cropId")} error={errors.cropId?.message}
          placeholder="Seleccionar"
          options={crops.map((c) => ({ value: c.id, label: c.name }))}
        />
        <Select label="Lote" {...register("lotId")} error={errors.lotId?.message}
          placeholder="Seleccionar"
          options={farmLots.map((l) => ({ value: l.id, label: l.name }))}
        />
      </div>

      <Select label="Tipo de labor" {...register("type")} error={errors.type?.message}
        options={LABOR_TYPES.map((t) => ({ value: t, label: laborTypeLabels[t] || t }))}
      />

      <Input label="Descripción" {...register("description")} error={errors.description?.message} placeholder="Descripción de la labor" />

      <div className="grid grid-cols-2 gap-3">
        <Input label="Fecha de labor" type="date" {...register("laborDate")} error={errors.laborDate?.message} />
        <Input label="Costo de mano de obra" type="number" step="0.01" min="0" {...register("laborCost")} error={errors.laborCost?.message} placeholder="0.00" />
      </div>

      <Input label="Número de trabajadores" type="number" min="1" {...register("workerCount")} error={errors.workerCount?.message} placeholder="1" />

      <Input label="Observaciones" {...register("notes")} placeholder="Notas adicionales (opcional)" />

      <Button type="submit" loading={loading} className="w-full">
        Guardar Labor
      </Button>
    </form>
  );
}
