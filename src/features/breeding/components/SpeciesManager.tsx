"use client";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { speciesSchema, type SpeciesFormData } from "../schemas/breedingSchema";
import { SPECIES_CATEGORIES, SPECIES_CATEGORY_LABELS } from "../domain/breedingRules";
import { createSpecies, updateSpecies, deleteSpecies } from "../services/breedingService";
import { useSpecies } from "../hooks/useBreeding";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import type { Species } from "@/types/modules";

export function SpeciesManager() {
  const { species, loading } = useSpecies();
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Species | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Species | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-zinc-100">Especies</h2>
        <Button size="sm" onClick={() => { setEditTarget(null); setShowForm(true); }}>
          <Plus size={16} /> Agregar
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <SpeciesFormInline
            editTarget={editTarget}
            saving={saving}
            onSave={async (data) => {
              setSaving(true);
              try {
                if (editTarget) {
                  await updateSpecies(editTarget.id, data);
                  toast.success("Especie actualizada");
                } else {
                  await createSpecies(data);
                  toast.success("Especie creada");
                }
                setShowForm(false);
                setEditTarget(null);
              } catch {
                toast.error("Error al guardar especie");
              } finally {
                setSaving(false);
              }
            }}
            onCancel={() => { setShowForm(false); setEditTarget(null); }}
          />
        )}
      </AnimatePresence>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-2xl bg-zinc-800/50 animate-pulse" />
          ))}
        </div>
      ) : species.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-zinc-600">No hay especies registradas</p>
          <p className="text-zinc-700 text-sm mt-1">Agrega una especie para comenzar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {species.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-3 rounded-2xl bg-zinc-900/60 border border-zinc-800/60 px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-zinc-100 truncate">{s.name}</p>
                <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                  <span className="capitalize">{SPECIES_CATEGORY_LABELS[s.category] || s.category}</span>
                  <span>·</span>
                  <span>Unidad: {s.unit}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setEditTarget(s); setShowForm(true); }}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setDeleteTarget(s)}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar Especie">
        <p className="text-zinc-400 mb-4">
          ¿Eliminar la especie <strong className="text-zinc-200">{deleteTarget?.name}</strong>?
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={async () => {
              if (!deleteTarget) return;
              try {
                await deleteSpecies(deleteTarget.id);
                toast.success("Especie eliminada");
              } catch {
                toast.error("Error al eliminar");
              }
              setDeleteTarget(null);
            }}
          >
            Eliminar
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function SpeciesFormInline({
  editTarget,
  saving,
  onSave,
  onCancel,
}: {
  editTarget: Species | null;
  saving: boolean;
  onSave: (data: SpeciesFormData) => Promise<void>;
  onCancel: () => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<SpeciesFormData>({
    resolver: zodResolver(speciesSchema) as Resolver<SpeciesFormData>,
    defaultValues: {
      name: editTarget?.name || "",
      category: editTarget?.category || "mamiferos",
      unit: editTarget?.unit || "",
      notes: editTarget?.notes || "",
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <form onSubmit={handleSubmit(onSave)} className="space-y-3 rounded-2xl bg-zinc-800/40 border border-zinc-700/50 p-4">
        <Input label="Nombre" {...register("name")} error={errors.name?.message} placeholder="Ej: Gallina, Vaca, etc." />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Categoría"
            {...register("category")}
            error={errors.category?.message}
            options={SPECIES_CATEGORIES.map((c) => ({ value: c, label: SPECIES_CATEGORY_LABELS[c] }))}
          />
          <Input label="Unidad de Medida" {...register("unit")} error={errors.unit?.message} placeholder="Ej: kg, litros, unidades" />
        </div>

        <Input label="Observaciones" {...register("notes")} placeholder="Notas (opcional)" />

        <div className="flex gap-3">
          <Button type="button" variant="ghost" className="flex-1" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" loading={saving} className="flex-1">
            {editTarget ? "Actualizar" : "Crear"}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
