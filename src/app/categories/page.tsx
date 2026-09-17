"use client";
import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { ensureDefaultCategories } from "@/lib/defaultCategories";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { CategoryForm } from "@/features/categories/components/CategoryForm";
import toast from "react-hot-toast";
import type { CategoryFormData } from "@/features/categories/schemas/categorySchema";
import type { Category } from "@/types";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

const PAGE_SIZE = 25;

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    await ensureDefaultCategories();
    db.categories.toArray().then(setCategories);
  };
  useEffect(() => { load(); }, []);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return categories.slice(start, start + PAGE_SIZE);
  }, [categories, page]);

  const handleSubmit = async (data: CategoryFormData) => {
    setLoading(true);
    try {
      if (editing) {
        await db.categories.update(editing.id, { ...data, syncStatus: "pending" });
        toast.success("Categoría actualizada");
      } else {
        await db.categories.add({
          id: crypto.randomUUID(),
          workspaceId: useWorkspaceStore.getState().activeWorkspaceId ?? "default",
          ...data,
          createdAt: new Date().toISOString(),
          syncStatus: "pending",
        });
        toast.success("Categoría creada");
      }
      setModalOpen(false);
      setEditing(null);
      load();
    } catch {
      toast.error("Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    await db.categories.delete(id);
    toast.success("Categoría eliminada");
    load();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Categorías</h1>
        <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus size={16} /> Nueva
        </Button>
      </div>

      <div className="space-y-2">
        {paged.map((c, i) => (
          <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            className="flex items-center justify-between rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: c.color + "20" }}>
                {c.icon}
              </div>
              <div>
                <p className="font-medium text-zinc-200">{c.name}</p>
                <p className="text-xs text-zinc-600" style={{ color: c.color }}>{c.color}</p>
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => { setEditing(c); setModalOpen(true); }} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300">
                <Pencil size={14} />
              </button>
              <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400">
                <Trash2 size={14} />
              </button>
            </div>
          </motion.div>
        ))}
        {categories.length === 0 && (
          <p className="text-center text-zinc-600 py-12">No hay categorías. Crea la primera.</p>
        )}
      </div>
      <Pagination page={page} totalItems={categories.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} title={editing ? "Editar Categoría" : "Nueva Categoría"}>
        <CategoryForm
          onSubmit={handleSubmit}
          defaultValues={editing ? { name: editing.name, color: editing.color, icon: editing.icon } : undefined}
          loading={loading}
        />
      </Modal>
    </motion.div>
  );
}
