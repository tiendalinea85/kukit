"use client";
import { useState, useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { partCompatibilitySchema, type PartCompatibilityFormData } from "../schemas/autopartsSchema";
import { useAutoParts, useVehicleModels, useVehicleBrands } from "../hooks/useAutoparts";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

interface Props {
  onSubmit: (data: PartCompatibilityFormData) => Promise<void>;
  defaultValues?: Partial<PartCompatibilityFormData>;
  loading?: boolean;
}

export function CompatibilityForm({ onSubmit, defaultValues, loading }: Props) {
  const { parts } = useAutoParts();
  const { models } = useVehicleModels();
  const [selectedModelId, setSelectedModelId] = useState(defaultValues?.modelId || "");

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<PartCompatibilityFormData>({
    resolver: zodResolver(partCompatibilitySchema) as Resolver<PartCompatibilityFormData>,
    defaultValues: {
      partId: defaultValues?.partId || "",
      modelId: defaultValues?.modelId || "",
      yearFrom: defaultValues?.yearFrom ?? new Date().getFullYear(),
      yearTo: defaultValues?.yearTo ?? null,
      engine: defaultValues?.engine || "",
      notes: defaultValues?.notes || "",
    },
  });

  const modelIdValue = watch("modelId");

  useEffect(() => {
    setSelectedModelId(modelIdValue);
  }, [modelIdValue]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Select label="Repuesto" {...register("partId")} error={errors.partId?.message} placeholder="Seleccionar repuesto"
        options={parts.map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` }))}
      />

      <Select label="Modelo de vehículo" {...register("modelId")} error={errors.modelId?.message} placeholder="Seleccionar modelo"
        options={models.map((m) => ({ value: m.id, label: `${m.brandName} ${m.name} (${m.startYear}${m.endYear ? "-" + m.endYear : "+"})` }))}
      />

      {selectedModelId && (() => {
        const selectedModel = models.find((m) => m.id === selectedModelId);
        if (!selectedModel) return null;
        return (
          <div className="flex items-center gap-4 px-4 py-2 rounded-xl bg-zinc-800/40 border border-zinc-700/50">
            <div>
              <span className="text-xs text-zinc-500">Marca:</span>
              <span className="ml-1.5 text-sm text-purple-400">{selectedModel.brandName}</span>
            </div>
            <div>
              <span className="text-xs text-zinc-500">Modelo:</span>
              <span className="ml-1.5 text-sm text-purple-400">{selectedModel.name}</span>
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-2 gap-3">
        <Input label="Año desde" type="number" min="1900" max="2100" {...register("yearFrom")} error={errors.yearFrom?.message} />
        <Input label="Año hasta (opcional)" type="number" min="1900" max="2100" {...register("yearTo")} error={errors.yearTo?.message} placeholder="Sin límite" />
      </div>

      <Input label="Motor" {...register("engine")} error={errors.engine?.message} placeholder="Ej: 1.6L TDI" />

      <Input label="Observaciones" {...register("notes")} placeholder="Notas adicionales (opcional)" />

      <Button type="submit" loading={loading} className="w-full">
        Guardar Compatibilidad
      </Button>
    </form>
  );
}
