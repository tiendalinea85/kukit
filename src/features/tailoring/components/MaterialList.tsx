"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Trash2, Plus } from "lucide-react";
import { useMaterials } from "../hooks/useTailoring";
import { deleteMaterial } from "../services/tailoringService";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/utils/format";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface Props {
  onAdd?: () => void;
}

export function MaterialList({ onAdd }: Props) {
  const { materials, loading } = useMaterials();
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const router = useRouter();

  const filtered = materials.filter((m) => {
    const haystack = `${m.code} ${m.name} ${m.unit}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteMaterial(deleteTarget.id);
    toast.success("Material eliminado");
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Materiales</h2>
        {onAdd && (
          <Button size="sm" onClick={onAdd}>
            <Plus size={16} />
            Nuevo
          </Button>
        )}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar materiales..."
          className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl pl-9 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-purple-500/50"
        />
      </div>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar Material">
        <p className="text-zinc-400 mb-4">
          ¿Eliminar el material <strong className="text-zinc-200">{deleteTarget?.name}</strong>?
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button variant="danger" className="flex-1" onClick={handleDelete}>Eliminar</Button>
        </div>
      </Modal>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-zinc-800/50 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-zinc-600">
            {search ? "No se encontraron materiales" : "No hay materiales registrados"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((material, i) => (
            <motion.div
              key={material.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="group rounded-xl bg-zinc-900/60 border border-zinc-800/60 p-4 hover:border-zinc-700/60 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-purple-500 bg-purple-600/10 px-2 py-0.5 rounded-md">
                      {material.code}
                    </span>
                  </div>
                  <h3 className="mt-1 font-medium text-zinc-100 truncate">{material.name}</h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                    <span>Unidad: {material.unit}</span>
                    <span>Stock: {material.stock}</span>
                  </div>
                </div>
                <div className="text-right ml-3">
                  <p className="text-sm font-semibold text-zinc-100">{formatCurrency(material.costPerUnit)}</p>
                  <p className="text-xs text-zinc-500">por {material.unit}</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-1 mt-2">
                <button
                  onClick={() => setDeleteTarget({ id: material.id, name: material.name })}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
