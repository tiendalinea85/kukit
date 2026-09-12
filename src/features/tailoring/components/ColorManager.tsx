"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit2, Trash2, Check, X } from "lucide-react";
import { useColors } from "../hooks/useTailoring";
import { createColor, updateColor, deleteColor } from "../services/tailoringService";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import toast from "react-hot-toast";

export function ColorManager() {
  const { colors, loading } = useColors();
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newHex, setNewHex] = useState("#000000");
  const [editName, setEditName] = useState("");
  const [editHex, setEditHex] = useState("#000000");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const handleAdd = async () => {
    if (!newName.trim()) { toast.error("Ingresa un nombre"); return; }
    try {
      await createColor({ name: newName, hex: newHex });
      toast.success("Color creado");
      setNewName("");
      setNewHex("#000000");
      setAdding(false);
    } catch {
      toast.error("Error al crear color");
    }
  };

  const handleEdit = async (id: string) => {
    if (!editName.trim()) { toast.error("Ingresa un nombre"); return; }
    try {
      await updateColor(id, { name: editName, hex: editHex });
      toast.success("Color actualizado");
      setEditId(null);
    } catch {
      toast.error("Error al actualizar");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteColor(deleteTarget.id);
    toast.success("Color eliminado");
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Colores</h2>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus size={16} />
          Nuevo
        </Button>
      </div>

      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-end gap-2 rounded-xl bg-zinc-900/60 border border-zinc-800 p-3">
              <div
                className="w-10 h-10 rounded-lg border border-zinc-700 shrink-0"
                style={{ backgroundColor: newHex }}
              />
              <input
                type="color"
                value={newHex}
                onChange={(e) => setNewHex(e.target.value)}
                className="sr-only"
                id="new-color-picker"
              />
              <label
                htmlFor="new-color-picker"
                className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300 pb-0.5"
              >
                Color
              </label>
              <div className="flex-1">
                <Input
                  label="Nombre"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej: Rojo, Azul"
                  autoFocus
                />
              </div>
              <Button size="sm" onClick={handleAdd}>
                <Check size={14} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNewName(""); setNewHex("#000000"); }}>
                <X size={14} />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar Color">
        <p className="text-zinc-400 mb-4">
          ¿Eliminar el color <strong className="text-zinc-200">{deleteTarget?.name}</strong>?
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button variant="danger" className="flex-1" onClick={handleDelete}>Eliminar</Button>
        </div>
      </Modal>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-xl bg-zinc-800/50 animate-pulse" />)}
        </div>
      ) : colors.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-zinc-600">No hay colores registrados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {colors.map((color, i) => (
            <motion.div
              key={color.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-3 rounded-xl bg-zinc-900/60 border border-zinc-800/60 px-4 py-3"
            >
              {editId === color.id ? (
                <>
                  <div
                    className="w-8 h-8 rounded-lg border border-zinc-700 shrink-0"
                    style={{ backgroundColor: editHex }}
                  />
                  <input
                    type="color"
                    value={editHex}
                    onChange={(e) => setEditHex(e.target.value)}
                    className="sr-only"
                    id={`edit-color-${color.id}`}
                  />
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 rounded-lg bg-zinc-800/60 border border-zinc-700/50 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-purple-500"
                    autoFocus
                  />
                  <button onClick={() => handleEdit(color.id)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-emerald-400">
                    <Check size={16} />
                  </button>
                  <button onClick={() => setEditId(null)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400">
                    <X size={16} />
                  </button>
                </>
              ) : (
                <>
                  <div
                    className="w-8 h-8 rounded-lg border border-zinc-700 shrink-0"
                    style={{ backgroundColor: color.hex }}
                  />
                  <span className="flex-1 text-sm text-zinc-200 font-medium">{color.name}</span>
                  <span className="text-xs text-zinc-600 font-mono">{color.hex}</span>
                  <button
                    onClick={() => { setEditId(color.id); setEditName(color.name); setEditHex(color.hex); }}
                    className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget({ id: color.id, name: color.name })}
                    className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
