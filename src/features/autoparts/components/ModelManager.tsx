"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Car } from "lucide-react";
import { useVehicleBrands, useVehicleModels } from "../hooks/useAutoparts";
import { createVehicleModel, updateVehicleModel, deleteVehicleModel } from "../services/autopartsService";
import { vehicleModelSchema, type VehicleModelFormData } from "../schemas/autopartsSchema";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import toast from "react-hot-toast";

export function ModelManager() {
  const { brands } = useVehicleBrands();
  const { models } = useVehicleModels();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; data: VehicleModelFormData } | null>(null);
  const [formData, setFormData] = useState<VehicleModelFormData>({
    brandId: "",
    name: "",
    startYear: new Date().getFullYear(),
    endYear: null,
    engine: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const openNew = () => {
    setEditing(null);
    setFormData({ brandId: "", name: "", startYear: new Date().getFullYear(), endYear: null, engine: "", notes: "" });
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (model: { id: string; brandId: string; name: string; startYear: number; endYear: number | null; engine: string; notes: string }) => {
    const data: VehicleModelFormData = {
      brandId: model.brandId,
      name: model.name,
      startYear: model.startYear,
      endYear: model.endYear,
      engine: model.engine,
      notes: model.notes,
    };
    setEditing({ id: model.id, data });
    setFormData(data);
    setErrors({});
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const result = vehicleModelSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as string;
        fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      if (editing) {
        await updateVehicleModel(editing.id, result.data);
        toast.success("Modelo actualizado");
      } else {
        await createVehicleModel(result.data);
        toast.success("Modelo creado");
      }
      setModalOpen(false);
    } catch {
      toast.error("Error al guardar el modelo");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteVehicleModel(id);
    toast.success("Modelo eliminado");
  };

  const updateField = (field: keyof VehicleModelFormData, value: VehicleModelFormData[keyof VehicleModelFormData]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Modelos</h3>
        <Button size="sm" onClick={openNew}>
          <Plus size={14} /> Nuevo
        </Button>
      </div>

      {models.length === 0 ? (
        <div className="text-center py-8">
          <Car size={32} className="mx-auto text-zinc-700 mb-2" />
          <p className="text-zinc-600 text-sm">No hay modelos registrados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {models.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center justify-between rounded-xl bg-zinc-900/60 border border-zinc-800/60 px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-600/15 text-purple-400 shrink-0">
                  <Car size={14} />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-zinc-200 truncate">{m.brandName} {m.name}</p>
                  <p className="text-xs text-zinc-500">
                    {m.startYear}{m.endYear ? ` - ${m.endYear}` : " - Actual"}{m.engine ? ` · ${m.engine}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300">
                  <Pencil size={14} />
                </button>
                <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400">
                  <Trash2 size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar Modelo" : "Nuevo Modelo"}>
        <div className="space-y-4">
          <Select label="Marca" value={formData.brandId} onChange={(e) => updateField("brandId", e.target.value)}
            error={errors.brandId} placeholder="Seleccionar marca"
            options={brands.map((b) => ({ value: b.id, label: b.name }))}
          />
          <Input label="Nombre del modelo" value={formData.name} onChange={(e) => updateField("name", e.target.value)}
            error={errors.name} placeholder="Ej: Corolla"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Año inicio" type="number" min="1900" max="2100" value={formData.startYear} onChange={(e) => updateField("startYear", Number(e.target.value))} error={errors.startYear} />
            <Input label="Año fin (opcional)" type="number" min="1900" max="2100" value={formData.endYear ?? ""} onChange={(e) => updateField("endYear", e.target.value ? Number(e.target.value) : null)} error={errors.endYear} placeholder="Actual" />
          </div>
          <Input label="Motor" value={formData.engine} onChange={(e) => updateField("engine", e.target.value)} error={errors.engine} placeholder="Ej: 1.8L VVT-i" />
          <Input label="Observaciones" value={formData.notes} onChange={(e) => updateField("notes", e.target.value)} placeholder="Notas adicionales (opcional)" />
          <Button onClick={handleSubmit} loading={loading} className="w-full">
            Guardar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
