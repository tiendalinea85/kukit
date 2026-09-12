"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Globe } from "lucide-react";
import { useVehicleBrands } from "../hooks/useAutoparts";
import { createVehicleBrand, updateVehicleBrand, deleteVehicleBrand } from "../services/autopartsService";
import { vehicleBrandSchema, type VehicleBrandFormData } from "../schemas/autopartsSchema";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import toast from "react-hot-toast";

export function BrandManager() {
  const { brands } = useVehicleBrands();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string; country: string } | null>(null);
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; country?: string }>({});

  const openNew = () => {
    setEditing(null);
    setName("");
    setCountry("");
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (brand: { id: string; name: string; country: string }) => {
    setEditing(brand);
    setName(brand.name);
    setCountry(brand.country);
    setErrors({});
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const result = vehicleBrandSchema.safeParse({ name, country });
    if (!result.success) {
      const fieldErrors: { name?: string; country?: string } = {};
      for (const issue of result.error.issues) {
        if (issue.path[0] === "name") fieldErrors.name = issue.message;
        if (issue.path[0] === "country") fieldErrors.country = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      if (editing) {
        await updateVehicleBrand(editing.id, result.data);
        toast.success("Marca actualizada");
      } else {
        await createVehicleBrand(result.data);
        toast.success("Marca creada");
      }
      setModalOpen(false);
    } catch {
      toast.error("Error al guardar la marca");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteVehicleBrand(id);
    toast.success("Marca eliminada");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Marcas</h3>
        <Button size="sm" onClick={openNew}>
          <Plus size={14} /> Nueva
        </Button>
      </div>

      {brands.length === 0 ? (
        <div className="text-center py-8">
          <Globe size={32} className="mx-auto text-zinc-700 mb-2" />
          <p className="text-zinc-600 text-sm">No hay marcas registradas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {brands.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center justify-between rounded-xl bg-zinc-900/60 border border-zinc-800/60 px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-600/15 text-purple-400 shrink-0">
                  <Globe size={14} />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-zinc-200 truncate">{b.name}</p>
                  <p className="text-xs text-zinc-500">{b.country}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300">
                  <Pencil size={14} />
                </button>
                <button onClick={() => handleDelete(b.id)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400">
                  <Trash2 size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar Marca" : "Nueva Marca"}>
        <div className="space-y-4">
          <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="Ej: Toyota" />
          <Input label="País" value={country} onChange={(e) => setCountry(e.target.value)} error={errors.country} placeholder="Ej: Japón" />
          <Button onClick={handleSubmit} loading={loading} className="w-full">
            Guardar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
