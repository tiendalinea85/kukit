"use client";
import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Package, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { ProductForm } from "@/features/sales/components/ProductForm";
import { createProduct, updateProduct, deleteProduct, adjustStock } from "@/features/sales/services/productService";
import { useProducts } from "@/features/sales/hooks/useProducts";
import { db } from "@/lib/db";
import toast from "react-hot-toast";
import type { ProductWithStockFormData } from "@/features/sales/schemas/productSchema";
import type { ProductWithStock } from "@/features/sales/services/productService";
import { Pagination } from "@/components/ui/Pagination";
import type { Category } from "@/types";

const PAGE_SIZE = 25;

export default function ProductsPage() {
  const { products } = useProducts();
  const [categories, setCategories] = useState<Category[]>([]);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductWithStock | null>(null);
  const [loading, setLoading] = useState(false);

  const [adjustTarget, setAdjustTarget] = useState<ProductWithStock | null>(null);
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [adjustLoading, setAdjustLoading] = useState(false);

  useEffect(() => {
    db.categories.toArray().then(setCategories);
  }, []);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return products.slice(start, start + PAGE_SIZE);
  }, [products, page]);

  const handleSubmit = async (data: ProductWithStockFormData) => {
    setLoading(true);
    try {
      if (editing) {
        await updateProduct(editing.id, data);
        toast.success("Producto actualizado");
      } else {
        await createProduct(data);
        toast.success("Producto creado");
      }
      setModalOpen(false);
      setEditing(null);
    } catch {
      toast.error("Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (p: ProductWithStock) => {
    await deleteProduct(p.id);
    toast.success("Producto enviado a la papelera");
  };

  const handleAdjust = async () => {
    if (!adjustTarget) return;
    const delta = Number(adjustDelta);
    if (!Number.isFinite(delta) || delta === 0) {
      toast.error("El ajuste debe ser distinto de cero");
      return;
    }
    setAdjustLoading(true);
    try {
      await adjustStock({ productId: adjustTarget.id, delta, notes: adjustNotes });
      toast.success("Stock ajustado");
      setAdjustTarget(null);
      setAdjustDelta("");
      setAdjustNotes("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al ajustar stock");
    } finally {
      setAdjustLoading(false);
    }
  };

  const stockColor = (stock: number) =>
    stock > 0 ? "text-emerald-400" : stock === 0 ? "text-zinc-600" : "text-red-400";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Productos</h1>
        <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus size={16} /> Nuevo
        </Button>
      </div>

      <div className="space-y-2">
        {paged.map((p, i) => {
          const cat = categories.find((c) => c.id === p.categoryId);
          return (
            <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="flex items-center justify-between rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-600/15 text-purple-400 shrink-0">
                  <Package size={18} />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-zinc-200 truncate">{p.name}</p>
                  <p className="text-xs text-zinc-600 truncate">
                    {p.code}{p.color ? ` · ${p.color}` : ""}
                    {cat ? ` · ${cat.name}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-sm font-semibold ${stockColor(p.stock)}`}>
                  Stock: {p.stock}
                </span>
                <button onClick={() => { setAdjustTarget(p); setAdjustDelta(""); setAdjustNotes(""); }} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-amber-400" title="Ajustar stock">
                  <SlidersHorizontal size={14} />
                </button>
                <div className="flex gap-1">
                  <button onClick={() => { setEditing(p); setModalOpen(true); }} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(p)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
        {products.length === 0 && (
          <div className="text-center py-16">
            <Package size={40} className="mx-auto text-zinc-700 mb-3" />
            <p className="text-zinc-600 text-lg">No hay productos registrados</p>
            <p className="text-zinc-700 text-sm mt-1">Crea productos para registrar ventas y controlar inventario.</p>
          </div>
        )}
      </div>
      <Pagination page={page} totalItems={products.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} title={editing ? "Editar Producto" : "Nuevo Producto"}>
        <ProductForm
          onSubmit={handleSubmit}
          defaultValues={editing ? { code: editing.code, name: editing.name, color: editing.color, categoryId: editing.categoryId } : undefined}
          categories={categories}
          loading={loading}
        />
      </Modal>

      <Modal open={!!adjustTarget} onClose={() => setAdjustTarget(null)} title={`Ajustar stock · ${adjustTarget?.name ?? ""}`}>
        <div className="space-y-4">
          <p className="text-sm text-zinc-500">
            Usa un valor positivo para agregar unidades y negativo para descontar.
          </p>
          <Input
            label="Cantidad"
            type="number"
            step="any"
            value={adjustDelta}
            onChange={(e) => setAdjustDelta(e.target.value)}
            placeholder="Ej: -3 o 5"
          />
          <Input
            label="Motivo"
            value={adjustNotes}
            onChange={(e) => setAdjustNotes(e.target.value)}
            placeholder="Ej: conteo físico, daño, devolución"
          />
          <Button onClick={handleAdjust} loading={adjustLoading} className="w-full">
            Guardar ajuste
          </Button>
        </div>
      </Modal>
    </motion.div>
  );
}
