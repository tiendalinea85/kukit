"use client";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { breedingLotSchema, type BreedingLotFormData } from "../schemas/breedingSchema";
import { SPECIES_CATEGORIES, SPECIES_CATEGORY_LABELS } from "../domain/breedingRules";
import { createBreedingLot, updateBreedingLot, deleteBreedingLot } from "../services/breedingService";
import { useBreedingLots, useSpecies } from "../hooks/useBreeding";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Plus, Pencil, Trash2, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import type { BreedingLot } from "@/types/modules";

export function BreedingLotManager() {
  const { lots, loading } = useBreedingLots();
  const { species } = useSpecies();
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<BreedingLot | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BreedingLot | null>(null);
  const [saving, setSaving] = useState(false);

  const speciesMap = Object.fromEntries(species.map((s) => [s.id, s.name]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-zinc-100">Lotes</h2>
        <Button size="sm" onClick={() => { setEditTarget(null); setShowForm(true); }}>
          <Plus size={16} /> Agregar
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <BreedingLotFormInline
            editTarget={editTarget}
            speciesList={species}
            saving={saving}
            onSave={async (data) => {
              setSaving(true);
              try {
                const speciesName = speciesMap[data.speciesId] || "";
                if (editTarget) {
                  await updateBreedingLot(editTarget.id, data);
                  toast.success("Lote actualizado");
                } else {
                  await createBreedingLot(data);
                  toast.success("Lote creado");
                }
                setShowForm(false);
                setEditTarget(null);
              } catch {
                toast.error("Error al guardar lote");
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
            <div key={i} className="h-20 rounded-2xl bg-zinc-800/50 animate-pulse" />
          ))}
        </div>
      ) : lots.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-zinc-600">No hay lotes registrados</p>
          <p className="text-zinc-700 text-sm mt-1">Crea un lote para organizar tus animales</p>
        </div>
      ) : (
        <div className="space-y-2">
          {lots.map((lot, i) => (
            <motion.div
              key={lot.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-purple-500 bg-purple-600/10 px-2 py-0.5 rounded-md">{lot.code}</span>
                    <h3 className="font-medium text-zinc-100 truncate">{lot.name}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
                    <span>{speciesMap[lot.speciesId] || "Sin especie"}</span>
                    <span>·</span>
                    <MapPin size={12} className="inline" />
                    <span>{lot.location || "Sin ubicación"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setEditTarget(lot); setShowForm(true); }}
                    className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(lot)}
                    className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <div className="rounded-lg bg-zinc-800/60 px-3 py-1.5">
                  <span className="text-zinc-500">Capacidad: </span>
                  <span className="text-zinc-300 font-medium">{lot.capacity}</span>
                </div>
                <div className="rounded-lg bg-zinc-800/60 px-3 py-1.5">
                  <span className="text-zinc-500">Actual: </span>
                  <span className={`font-medium ${lot.currentCount >= lot.capacity ? "text-red-400" : "text-emerald-400"}`}>
                    {lot.currentCount}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar Lote">
        <p className="text-zinc-400 mb-4">
          ¿Eliminar el lote <strong className="text-zinc-200">{deleteTarget?.name}</strong>?
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={async () => {
              if (!deleteTarget) return;
              try {
                await deleteBreedingLot(deleteTarget.id);
                toast.success("Lote eliminado");
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

function BreedingLotFormInline({
  editTarget,
  speciesList,
  saving,
  onSave,
  onCancel,
}: {
  editTarget: BreedingLot | null;
  speciesList: { id: string; name: string }[];
  saving: boolean;
  onSave: (data: BreedingLotFormData) => Promise<void>;
  onCancel: () => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<BreedingLotFormData>({
    resolver: zodResolver(breedingLotSchema) as Resolver<BreedingLotFormData>,
    defaultValues: {
      name: editTarget?.name || "",
      speciesId: editTarget?.speciesId || "",
      location: editTarget?.location || "",
      capacity: editTarget?.capacity ?? undefined,
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
        <Input label="Nombre" {...register("name")} error={errors.name?.message} placeholder="Ej: Lote Norte, Corral 1" />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Especie"
            {...register("speciesId")}
            error={errors.speciesId?.message}
            placeholder="Seleccionar"
            options={speciesList.map((s) => ({ value: s.id, label: s.name }))}
          />
          <Input label="Capacidad" type="number" min="1" {...register("capacity")} error={errors.capacity?.message} placeholder="0" />
        </div>

        <Input label="Ubicación" {...register("location")} error={errors.location?.message} placeholder="Ej: Campo sur, Galpón A" />

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
