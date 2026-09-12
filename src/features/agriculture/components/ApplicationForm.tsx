"use client";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { applicationSchema, type ApplicationFormData } from "../schemas/agricultureSchema";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import type { Crop, FarmLot, AgroInput } from "@/types/modules";

interface Props {
  onSubmit: (data: ApplicationFormData) => Promise<void>;
  defaultValues?: Partial<ApplicationFormData>;
  loading?: boolean;
  code?: string;
}

export function ApplicationForm({ onSubmit, defaultValues, loading, code }: Props) {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [farmLots, setFarmLots] = useState<FarmLot[]>([]);
  const [agroInputs, setAgroInputs] = useState<AgroInput[]>([]);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const { register, handleSubmit, formState: { errors } } = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      cropId: defaultValues?.cropId || "",
      lotId: defaultValues?.lotId || "",
      inputId: defaultValues?.inputId || "",
      quantity: defaultValues?.quantity ?? undefined,
      applicationDate: defaultValues?.applicationDate || new Date().toISOString().split("T")[0],
      notes: defaultValues?.notes || "",
    },
  });

  useEffect(() => {
    if (!activeWorkspaceId) return;
    db.crops.where("workspaceId").equals(activeWorkspaceId).filter((c) => c.deleted !== true).toArray().then(setCrops);
    db.farmLots.where("workspaceId").equals(activeWorkspaceId).filter((l) => l.deleted !== true).toArray().then(setFarmLots);
    db.agroInputs.where("workspaceId").equals(activeWorkspaceId).filter((i) => i.deleted !== true).toArray().then(setAgroInputs);
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

      <Select label="Insumo" {...register("inputId")} error={errors.inputId?.message}
        placeholder="Seleccionar"
        options={agroInputs.map((i) => ({ value: i.id, label: `${i.name} (${i.unit})` }))}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input label="Cantidad" type="number" step="0.01" min="0.01" {...register("quantity")} error={errors.quantity?.message} placeholder="0" />
        <Input label="Fecha de aplicación" type="date" {...register("applicationDate")} error={errors.applicationDate?.message} />
      </div>

      <Input label="Observaciones" {...register("notes")} placeholder="Notas adicionales (opcional)" />

      <Button type="submit" loading={loading} className="w-full">
        Guardar Aplicación
      </Button>
    </form>
  );
}
