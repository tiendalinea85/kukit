"use client";
import { Suspense, useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Search, Trash2, Ban, PackageCheck, ReceiptText, Plus, Pencil } from "lucide-react";
import Link from "next/link";
import { usePurchases } from "@/features/purchases/hooks/usePurchases";
import { receivePurchase, voidPurchase, deletePurchase, listPurchaseDetailsByPurchase } from "@/features/purchases/services/purchaseService";
import { formatCurrency } from "@/utils/format";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import toast from "react-hot-toast";
import type { Purchase, PurchaseDetail } from "@/types";

function PurchasesContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";
  const { purchases, loading } = usePurchases();
  const [search, setSearch] = useState(q);
  const [detailsByPurchase, setDetailsByPurchase] = useState<Record<string, PurchaseDetail[]>>({});
  const [receiveTarget, setReceiveTarget] = useState<Purchase | null>(null);
  const [voidTarget, setVoidTarget] = useState<Purchase | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Purchase | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    listPurchaseDetailsByPurchase().then(setDetailsByPurchase);
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return purchases
      .filter((p) => {
        if (!s) return true;
        const details = detailsByPurchase[p.id] ?? [];
        const haystack = [
          p.code,
          p.supplier,
          p.paymentMethod,
          p.status,
          String(p.total),
          ...details.map((d) => `${d.code} ${d.name} ${d.color}`),
        ].join(" ").toLowerCase();
        return haystack.includes(s);
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [purchases, search, detailsByPurchase]);

  const handleReceive = async () => {
    if (!receiveTarget) return;
    setActionLoading(true);
    try {
      await receivePurchase(receiveTarget.id);
      toast.success("Compra recibida: el inventario fue actualizado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo recibir la compra");
    } finally {
      setActionLoading(false);
      setReceiveTarget(null);
    }
  };

  const handleVoid = async () => {
    if (!voidTarget) return;
    setActionLoading(true);
    try {
      await voidPurchase(voidTarget.id);
      toast.success(voidTarget.status === "recibida" ? "Compra anulada (inventario revertido)" : "Compra anulada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo anular la compra");
    } finally {
      setActionLoading(false);
      setVoidTarget(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deletePurchase(deleteTarget.id);
    toast.success("Compra enviada a la papelera");
    setDeleteTarget(null);
  };

  const statusBadge = (p: Purchase) => (
    <span className={`text-xs px-2 py-0.5 rounded-full ${
      p.status === "recibida" ? "bg-emerald-600/20 text-emerald-400" :
      p.status === "pendiente" ? "bg-amber-600/20 text-amber-400" :
      "bg-red-600/20 text-red-400"
    }`}>
      {p.status === "recibida" ? "Recibida" : p.status === "pendiente" ? "Pendiente" : "Anulada"}
    </span>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Compras</h1>
        <Link href="/purchases/new">
          <Button size="sm"><Plus size={16} /> Nueva compra</Button>
        </Link>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por código, proveedor o producto..." className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl pl-9 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-purple-500/50"
        />
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500 text-center py-10">Cargando...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ReceiptText size={40} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-600 text-lg">No hay compras registradas</p>
          <p className="text-zinc-700 text-sm mt-1">Registra compras a proveedores para controlar tus entradas de mercadería.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-4"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-zinc-200 truncate">{p.supplier}</p>
                  <p className="text-xs text-zinc-600">{p.code} • {p.date} • {p.paymentMethod.replace("_", " ")}</p>
                </div>
                <p className="text-sm font-bold text-purple-400 shrink-0">{formatCurrency(p.total)}</p>
              </div>
              <div className="flex items-center justify-between mt-3">
                {statusBadge(p)}
                <div className="flex gap-1.5">
                  {p.status === "pendiente" && (
                    <>
                      <button onClick={() => setReceiveTarget(p)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-emerald-400" title="Recibir">
                        <PackageCheck size={15} />
                      </button>
                      <Link href={`/purchases/edit/${p.id}`} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300">
                        <Pencil size={15} />
                      </Link>
                    </>
                  )}
                  <button onClick={() => setVoidTarget(p)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400" title="Anular">
                    <Ban size={15} />
                  </button>
                  <button onClick={() => setDeleteTarget(p)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400" title="Eliminar">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Modal open={!!receiveTarget} onClose={() => setReceiveTarget(null)} title="Recibir Compra">
        <p className="text-zinc-400 mb-4">
          ¿Marcar como recibida la compra <strong className="text-zinc-200">{receiveTarget?.code}</strong> de <strong className="text-zinc-200">{receiveTarget?.supplier}</strong>?
          Los productos entrarán al inventario automáticamente.
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setReceiveTarget(null)}>Cancelar</Button>
          <Button className="flex-1" loading={actionLoading} onClick={handleReceive}>Recibir</Button>
        </div>
      </Modal>

      <Modal open={!!voidTarget} onClose={() => setVoidTarget(null)} title="Anular Compra">
        <p className="text-zinc-400 mb-4">
          ¿Anular la compra <strong className="text-zinc-200">{voidTarget?.code}</strong> por <strong className="text-zinc-200">{formatCurrency(voidTarget?.total || 0)}</strong>?
          {voidTarget?.status === "recibida" && " El inventario será revertido automáticamente."}
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setVoidTarget(null)}>Cancelar</Button>
          <Button variant="danger" className="flex-1" loading={actionLoading} onClick={handleVoid}>Anular</Button>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar Compra">
        <p className="text-zinc-400 mb-4">¿Enviar la compra <strong className="text-zinc-200">{deleteTarget?.code}</strong> a la papelera? Puedes recuperarla desde ahí.</p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button variant="danger" className="flex-1" onClick={handleDelete}>Eliminar</Button>
        </div>
      </Modal>
    </motion.div>
  );
}

export default function PurchasesPage() {
  return (
    <Suspense fallback={<div />}>
      <PurchasesContent />
    </Suspense>
  );
}
