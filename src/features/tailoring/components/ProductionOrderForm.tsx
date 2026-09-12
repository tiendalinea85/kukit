"use client";
import { useState, useEffect, useCallback } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  productionOrderSchema,
  type ProductionOrderFormData,
} from "../schemas/tailoringSchema";
import { computeMaterialTotal } from "../domain/tailoringRules";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { db } from "@/lib/db";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/utils/format";
import type { Garment, Size, Color, Material, ProductionMaterial } from "@/types/modules";

interface MaterialRow {
  id: string;
  materialId: string;
  materialName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

interface Props {
  onSubmit: (
    data: ProductionOrderFormData,
    materials: MaterialRow[]
  ) => Promise<void>;
  defaultValues?: Partial<ProductionOrderFormData>;
  defaultMaterials?: ProductionMaterial[];
  loading?: boolean;
  code?: string;
}

export function ProductionOrderForm({
  onSubmit,
  defaultValues,
  defaultMaterials,
  loading,
  code,
}: Props) {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialRows, setMaterialRows] = useState<MaterialRow[]>([]);
  const [mounted, setMounted] = useState(false);
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!workspaceId) return;
    Promise.all([
      db.garments.where("workspaceId").equals(workspaceId).and((g) => !g.deleted).toArray(),
      db.sizes.where("workspaceId").equals(workspaceId).and((s) => !s.deleted).toArray(),
      db.garmentColors.where("workspaceId").equals(workspaceId).and((c) => !c.deleted).toArray(),
      db.materials.where("workspaceId").equals(workspaceId).and((m) => !m.deleted).toArray(),
    ]).then(([g, s, c, m]) => {
      setGarments(g);
      setSizes(s);
      setColors(c);
      setMaterials(m);
    });
  }, [workspaceId]);

  useEffect(() => {
    if (defaultMaterials && defaultMaterials.length > 0) {
      setMaterialRows(
        defaultMaterials.map((pm) => ({
          id: pm.id,
          materialId: pm.materialId,
          materialName: pm.materialName,
          quantity: pm.quantity,
          unitCost: pm.unitCost,
          totalCost: pm.totalCost,
        }))
      );
    }
  }, [defaultMaterials]);

  const defaultDate = new Date().toISOString().split("T")[0];

  const { register, handleSubmit, watch, formState: { errors } } = useForm<ProductionOrderFormData>({
    resolver: zodResolver(productionOrderSchema) as Resolver<ProductionOrderFormData>,
    defaultValues: {
      garmentId: defaultValues?.garmentId || "",
      sizeId: defaultValues?.sizeId || "",
      colorId: defaultValues?.colorId || "",
      quantity: defaultValues?.quantity ?? undefined,
      unitCost: defaultValues?.unitCost ?? undefined,
      startDate: defaultValues?.startDate || defaultDate,
      dueDate: defaultValues?.dueDate || "",
      notes: defaultValues?.notes || "",
    },
  });

  const quantity = watch("quantity") || 0;
  const unitCost = watch("unitCost") || 0;

  const materialsTotal = materialRows.reduce((sum, r) => sum + r.totalCost, 0);

  const addMaterialRow = useCallback(() => {
    setMaterialRows((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        materialId: "",
        materialName: "",
        quantity: 1,
        unitCost: 0,
        totalCost: 0,
      },
    ]);
  }, []);

  const removeMaterialRow = useCallback((id: string) => {
    setMaterialRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const updateMaterialRow = useCallback(
    (id: string, field: keyof MaterialRow, value: string | number) => {
      setMaterialRows((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r;
          const updated = { ...r, [field]: value };
          if (field === "materialId") {
            const mat = materials.find((m) => m.id === value);
            updated.materialName = mat?.name || "";
            updated.unitCost = mat?.costPerUnit || 0;
            updated.totalCost = computeMaterialTotal(updated.quantity, updated.unitCost);
          }
          if (field === "quantity" || field === "unitCost") {
            updated.totalCost = computeMaterialTotal(updated.quantity, updated.unitCost);
          }
          return updated;
        })
      );
    },
    [materials]
  );

  const handleFormSubmit = async (data: ProductionOrderFormData) => {
    await onSubmit(data, materialRows);
  };

  if (!mounted) return null;

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {code && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800/40 border border-zinc-700/50">
          <span className="text-xs text-zinc-500">Código:</span>
          <span className="text-sm font-mono text-purple-400">{code}</span>
        </div>
      )}

      <Select
        label="Prenda"
        {...register("garmentId")}
        error={errors.garmentId?.message}
        placeholder="Seleccionar prenda"
        options={garments.map((g) => ({ value: g.id, label: `${g.code} - ${g.name}` }))}
      />

      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Talla"
          {...register("sizeId")}
          error={errors.sizeId?.message}
          placeholder="Seleccionar"
          options={sizes.map((s) => ({ value: s.id, label: s.name }))}
        />
        <Select
          label="Color"
          {...register("colorId")}
          error={errors.colorId?.message}
          placeholder="Seleccionar"
          options={colors.map((c) => ({ value: c.id, label: c.name }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Cantidad"
          type="number"
          min="1"
          step="1"
          {...register("quantity")}
          error={errors.quantity?.message}
          placeholder="0"
        />
        <Input
          label="Costo Unitario"
          type="number"
          step="0.01"
          min="0"
          {...register("unitCost")}
          error={errors.unitCost?.message}
          placeholder="0.00"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Fecha Inicio" type="date" {...register("startDate")} error={errors.startDate?.message} />
        <Input label="Fecha Vencimiento" type="date" {...register("dueDate")} error={errors.dueDate?.message} />
      </div>

      <Input label="Observaciones" {...register("notes")} placeholder="Notas adicionales (opcional)" />

      <div className="rounded-xl bg-zinc-800/30 border border-zinc-700/40 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-300">Materiales</h3>
          <Button type="button" variant="ghost" size="sm" onClick={addMaterialRow}>
            <Plus size={14} />
            Agregar
          </Button>
        </div>

        {materialRows.length === 0 && (
          <p className="text-xs text-zinc-600 text-center py-2">Sin materiales agregados</p>
        )}

        {materialRows.map((row) => (
          <div key={row.id} className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <select
                value={row.materialId}
                onChange={(e) => updateMaterialRow(row.id, "materialId", e.target.value)}
                className="w-full rounded-xl bg-zinc-800/60 border border-zinc-700/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-purple-500"
              >
                <option value="">Material</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="w-20">
              <input
                type="number"
                min="0"
                step="0.01"
                value={row.quantity}
                onChange={(e) => updateMaterialRow(row.id, "quantity", parseFloat(e.target.value) || 0)}
                className="w-full rounded-xl bg-zinc-800/60 border border-zinc-700/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-purple-500"
                placeholder="Cant."
              />
            </div>
            <div className="w-24">
              <input
                type="text"
                readOnly
                value={formatCurrency(row.totalCost)}
                className="w-full rounded-xl bg-zinc-800/40 border border-zinc-700/30 px-3 py-2 text-sm text-zinc-400"
              />
            </div>
            <button
              type="button"
              onClick={() => removeMaterialRow(row.id)}
              className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}

        {materialRows.length > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-zinc-700/40">
            <span className="text-xs text-zinc-500">Total materiales</span>
            <span className="text-sm font-medium text-purple-400">{formatCurrency(materialsTotal)}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-xl bg-purple-600/10 border border-purple-500/20 p-4">
        <span className="text-sm font-medium text-zinc-300">Costo Total</span>
        <span className="text-lg font-bold text-purple-400">{formatCurrency(quantity * unitCost)}</span>
      </div>

      <Button type="submit" loading={loading} className="w-full">
        Guardar Orden
      </Button>
    </form>
  );
}
