"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import toast from "react-hot-toast";
import type { Type } from "@/types";

export default function TypesPage() {
  const [types, setTypes] = useState<Type[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Type | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const load = () => db.types.toArray().then(setTypes);
  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      if (editing) {
        await db.types.update(editing.id, { name: name.trim(), syncStatus: "pending" });
        toast.success("Tipo actualizado");
      } else {
        await db.types.add({ id: crypto.randomUUID(), name: name.trim(), createdAt: new Date().toISOString(), syncStatus: "local" });
        toast.success("Tipo creado");
      }
      setModalOpen(false);
      setEditing(null);
      setName("");
      load();
    } catch {
      toast.error("Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    await db.types.delete(id);
    toast.success("Tipo eliminado");
    load();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Tipos</h1>
        <Button size="sm" onClick={() => { setEditing(null); setName(""); setModalOpen(true); }}>
          <Plus size={16} /> Nuevo
        </Button>
      </div>

      <div className="space-y-2">
        {types.map((t, i) => (
          <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            className="flex items-center justify-between rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-4"
          >
            <p className="font-medium text-zinc-200">{t.name}</p>
            <div className="flex gap-1">
              <button onClick={() => { setEditing(t); setName(t.name); setModalOpen(true); }} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300">
                <Pencil size={14} />
              </button>
              <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400">
                <Trash2 size={14} />
              </button>
            </div>
          </motion.div>
        ))}
        {types.length === 0 && (
          <p className="text-center text-zinc-600 py-12">No hay tipos. Crea el primero.</p>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} title={editing ? "Editar Tipo" : "Nuevo Tipo"}>
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
          <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Fijo" />
          <Button type="submit" loading={loading} className="w-full">
            {editing ? "Actualizar" : "Crear"} Tipo
          </Button>
        </form>
      </Modal>
    </motion.div>
  );
}
