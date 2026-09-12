"use client";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Plus,
  Scissors,
  Settings,
  Palette,
  Package,
  Factory,
  Edit2,
  Trash2,
  Ban,
} from "lucide-react";
import { useGarments, useProductionOrders, useSizes, useColors, useMaterials } from "@/features/tailoring/hooks/useTailoring";
import { filterProductionOrders, canVoidProduction } from "@/features/tailoring/domain/tailoringRules";
import { deleteGarment, voidProductionOrder, deleteProductionOrder } from "@/features/tailoring/services/tailoringService";
import { SizeManager } from "@/features/tailoring/components/SizeManager";
import { ColorManager } from "@/features/tailoring/components/ColorManager";
import { MaterialList } from "@/features/tailoring/components/MaterialList";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { formatCurrency, formatDate } from "@/utils/format";
import Link from "next/link";
import toast from "react-hot-toast";

type Tab = "prendas" | "produccion" | "tallas" | "colores" | "materiales";

const PAGE_SIZE = 25;

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "prendas", label: "Prendas", icon: <Scissors size={16} /> },
  { key: "produccion", label: "Producción", icon: <Factory size={16} /> },
  { key: "tallas", label: "Tallas", icon: <Settings size={16} /> },
  { key: "colores", label: "Colores", icon: <Palette size={16} /> },
  { key: "materiales", label: "Materiales", icon: <Package size={16} /> },
];

const statusColors: Record<string, string> = {
  pendiente: "bg-amber-600/20 text-amber-400",
  en_proceso: "bg-blue-600/20 text-blue-400",
  completada: "bg-emerald-600/20 text-emerald-400",
  anulada: "bg-red-600/20 text-red-400",
};

const statusLabels: Record<string, string> = {
  pendiente: "Pendiente",
  en_proceso: "En Proceso",
  completada: "Completada",
  anulada: "Anulada",
};

export default function TailoringPage() {
  const [tab, setTab] = useState<Tab>("prendas");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [voidTarget, setVoidTarget] = useState<{ id: string; code: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteOrderTarget, setDeleteOrderTarget] = useState<{ id: string; code: string } | null>(null);

  const { garments, loading: loadingGarments } = useGarments();
  const { orders, loading: loadingOrders } = useProductionOrders();
  const { sizes, loading: loadingSizes } = useSizes();
  const { colors, loading: loadingColors } = useColors();
  const { materials, loading: loadingMaterials } = useMaterials();

  const filteredGarments = useMemo(() => {
    if (!search) return garments;
    const q = search.toLowerCase();
    return garments.filter(
      (g) => g.code.toLowerCase().includes(q) || g.name.toLowerCase().includes(q)
    );
  }, [garments, search]);

  const filteredOrders = useMemo(() => {
    return filterProductionOrders(orders, { search });
  }, [orders, search]);

  const pagedGarments = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredGarments.slice(start, start + PAGE_SIZE);
  }, [filteredGarments, page]);

  const pagedOrders = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [filteredOrders, page]);

  const handleDeleteGarment = async () => {
    if (!deleteTarget) return;
    await deleteGarment(deleteTarget.id);
    toast.success("Prenda eliminada");
    setDeleteTarget(null);
  };

  const handleVoidOrder = async () => {
    if (!voidTarget) return;
    try {
      await voidProductionOrder(voidTarget.id);
      toast.success("Orden anulada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al anular");
    }
    setVoidTarget(null);
  };

  const handleDeleteOrder = async () => {
    if (!deleteOrderTarget) return;
    await deleteProductionOrder(deleteOrderTarget.id);
    toast.success("Orden eliminada");
    setDeleteOrderTarget(null);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Taller de Confección</h1>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl whitespace-nowrap transition-colors ${
              tab === t.key
                ? "bg-purple-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {(tab === "prendas" || tab === "produccion") && (
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Buscar ${tab === "prendas" ? "prendas" : "órdenes"}...`}
            className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl pl-9 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-purple-500/50"
          />
        </div>
      )}

      <Modal open={!!voidTarget} onClose={() => setVoidTarget(null)} title="Anular Orden">
        <p className="text-zinc-400 mb-4">
          ¿Anular la orden <strong className="text-zinc-200">{voidTarget?.code}</strong>? Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setVoidTarget(null)}>Cancelar</Button>
          <Button variant="danger" className="flex-1" onClick={handleVoidOrder}>Anular</Button>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar Prenda">
        <p className="text-zinc-400 mb-4">
          ¿Eliminar la prenda <strong className="text-zinc-200">{deleteTarget?.name}</strong>?
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button variant="danger" className="flex-1" onClick={handleDeleteGarment}>Eliminar</Button>
        </div>
      </Modal>

      <Modal open={!!deleteOrderTarget} onClose={() => setDeleteOrderTarget(null)} title="Eliminar Orden">
        <p className="text-zinc-400 mb-4">
          ¿Eliminar la orden <strong className="text-zinc-200">{deleteOrderTarget?.code}</strong>?
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setDeleteOrderTarget(null)}>Cancelar</Button>
          <Button variant="danger" className="flex-1" onClick={handleDeleteOrder}>Eliminar</Button>
        </div>
      </Modal>

      {tab === "prendas" && (
        <div className="space-y-3">
          {loadingGarments ? (
            [1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-zinc-800/50 animate-pulse" />)
          ) : filteredGarments.length === 0 ? (
            <div className="text-center py-16">
              <Scissors size={32} className="mx-auto text-zinc-700 mb-3" />
              <p className="text-zinc-600 text-lg">No hay prendas</p>
              <p className="text-zinc-700 text-sm mt-1">Registra tu primera prenda</p>
            </div>
          ) : (
            pagedGarments.map((garment, i) => (
              <motion.div
                key={garment.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="group rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-4 hover:border-zinc-700/60 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-mono text-purple-500 bg-purple-600/10 px-2 py-0.5 rounded-md">
                      {garment.code}
                    </span>
                    <h3 className="mt-1.5 font-medium text-zinc-100 truncate">{garment.name}</h3>
                    {garment.description && (
                      <p className="text-xs text-zinc-500 mt-0.5 truncate">{garment.description}</p>
                    )}
                  </div>
                  <p className="text-lg font-semibold text-zinc-100 ml-3">
                    {formatCurrency(garment.salePrice)}
                  </p>
                </div>

                <div className="flex items-center gap-1 mt-3">
                  <div className="flex-1" />
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link href={`/tailoring/garments/edit/${garment.id}`}>
                      <button className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300">
                        <Edit2 size={14} />
                      </button>
                    </Link>
                    <button
                      onClick={() => setDeleteTarget({ id: garment.id, name: garment.name })}
                      className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
          <Pagination page={page} totalItems={filteredGarments.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          <Link href="/tailoring/garments/new">
            <div className="fixed bottom-20 right-4 md:static">
              <Button className="shadow-lg shadow-purple-600/25">
                <Plus size={18} />
                Nueva Prenda
              </Button>
            </div>
          </Link>
        </div>
      )}

      {tab === "produccion" && (
        <div className="space-y-3">
          {loadingOrders ? (
            [1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-zinc-800/50 animate-pulse" />)
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-16">
              <Factory size={32} className="mx-auto text-zinc-700 mb-3" />
              <p className="text-zinc-600 text-lg">No hay órdenes de producción</p>
              <p className="text-zinc-700 text-sm mt-1">Crea tu primera orden</p>
            </div>
          ) : (
            pagedOrders.map((order, i) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="group rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-4 hover:border-zinc-700/60 transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-purple-500 bg-purple-600/10 px-2 py-0.5 rounded-md">
                        {order.code}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[order.status] || ""}`}>
                        {statusLabels[order.status] || order.status}
                      </span>
                    </div>
                    <h3 className="mt-1.5 font-medium text-zinc-100 truncate">
                      {order.garmentName}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                      <span>Talla: {order.sizeName}</span>
                      <span>Color: {order.colorName}</span>
                      <span>Cant: {order.quantity}</span>
                    </div>
                  </div>
                  <p className="text-lg font-semibold text-zinc-100 ml-3">
                    {formatCurrency(order.totalCost)}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span>Vence: {formatDate(order.dueDate)}</span>
                </div>

                <div className="flex items-center gap-1 mt-3">
                  <div className="flex-1" />
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link href={`/tailoring/production/edit/${order.id}`}>
                      <button className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300">
                        <Edit2 size={14} />
                      </button>
                    </Link>
                    {canVoidProduction(order) && (
                      <button
                        onClick={() => setVoidTarget({ id: order.id, code: order.code })}
                        className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400"
                      >
                        <Ban size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteOrderTarget({ id: order.id, code: order.code })}
                      className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
          <Pagination page={page} totalItems={filteredOrders.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          <Link href="/tailoring/production/new">
            <div className="fixed bottom-20 right-4 md:static">
              <Button className="shadow-lg shadow-purple-600/25">
                <Plus size={18} />
                Nueva Orden
              </Button>
            </div>
          </Link>
        </div>
      )}

      {tab === "tallas" && <SizeManager />}
      {tab === "colores" && <ColorManager />}
      {tab === "materiales" && <MaterialList />}
    </motion.div>
  );
}
