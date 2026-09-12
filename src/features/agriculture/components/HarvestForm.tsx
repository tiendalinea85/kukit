"use client";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { harvestSchema, type HarvestFormData } from "../schemas/agricultureSchema";
import { HARVEST_QUALITY, computeHarvestTotal } from "../domain/agricultureRules";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import type { Crop, FarmLot } from "@/types/modules";
import { formatCurrency } from "@/utils/format";

const qualityLabels: Record<string, string> = {
  premium: "Premium",
  estandar: "Estándar",
  baja: "Baja",
};

interface Props {
  onSubmit: (data: HarvestFormData) => Promise<void>;
  defaultValues?: Partial<HarvestFormData>;
  loading?: boolean;
  code?: string;
}

export function HarvestForm({ onSubmit, defaultValues, loading, code }: Props) {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [farmLots, setFarmLots] = useState<FarmLot[]>([]);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<HarvestFormData>({
    resolver: zodResolver(harvestSchema),
    defaultValues: {
      cropId: defaultValues?.cropId || "",
      lotId: defaultValues?.lotId || "",
      product: defaultValues?.product || "",
      quantity: defaultValues?.quantity ?? undefined,
      unit: defaultValues?.unit || "",
      unitPrice: defaultValues?.unitPrice ?? undefined,
      harvestDate: defaultValues?.harvestDate || new Date().toISOString().split("T")[0],
      quality: defaultValues?.quality || "estandar",
      notes: defaultValues?.notes || "",
    },
  });

  const quantity = watch("quantity") || 0;
  const unitPrice = watch("unitPrice") || 0;
  const totalValue = computeHarvestTotal(quantity, unitPrice);

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

      <Input label="Producto" {...register("product")} error={errors.product?.message} placeholder="Ej: Maíz" />

      <div className="grid grid-cols-3 gap-3">
        <Input label="Cantidad" type="number" step="0.01" min="0.01" {...register("quantity")} error={errors.quantity?.message} placeholder="0" />
        <Input label="Unidad" {...register("unit")} error={errors.unit?.message} placeholder="Ej: kg" />
        <Input label="Precio unitario" type="number" step="0.01" min="0" {...register("unitPrice")} error={errors.unitPrice?.message} placeholder="0.00" />
      </div>

      <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/50 p-4 text-center">
        <span className="text-xs text-zinc-500">Valor total</span>
        <p className="text-xl font-bold text-purple-400 mt-1">{formatCurrency(totalValue)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Fecha de cosecha" type="date" {...register("harvestDate")} error={errors.harvestDate?.message} />
        <Select label="Calidad" {...register("quality")} error={errors.quality?.message}
          options={HARVEST_QUALITY.map((q) => ({ value: q, label: qualityLabels[q] }))}
        />
      </div>

      <Input label="Observaciones" {...register("notes")} placeholder="Notas adicionales (opcional)" />

      <Button type="submit" loading={loading} className="w-full">
        Guardar Cosecha
      </Button>
    </form>
  );
}
