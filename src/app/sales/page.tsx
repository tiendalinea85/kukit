"use client";
import { Suspense, useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Search, Edit2, Trash2, Ban, CalendarRange, LayoutList, LayoutGrid, ReceiptText, Plus, CheckCircle2 } from "lucide-react";
import { useSales } from "@/features/sales/hooks/useSales";
import { useAppStore } from "@/stores/useAppStore";
import { formatCurrency, formatDate } from "@/utils/format";
import { filterSales, canEditSale, canVoidSale, SALE_STATUSES } from "@/features/sales/domain/saleRules";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import toast from "react-hot-toast";
import Link from "next/link";
import type { Sale, SaleDetail, Customer, PaymentMethod } from "@/types";

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  tarjeta_credito: "Tarjeta crédito",
  tarjeta_debito: "Tarjeta débito",
  yape: "Yape",
  plin: "Plin",
  transferencia: "Transferencia",
  otro: "Otro",
};

function SalesContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";
  const { sales, loading, voidById, remove } = useSales();
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [detailsBySale, setDetailsBySale] = useState<Record<string, SaleDetail[]>>({});
  const [search, setSearch] = useState(q);
  const [filterStatus, setFilterStatus] = useState<"all" | Sale["status"]>("all");
  const [filterPayment, setFilterPayment] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [voidTarget, setVoidTarget] = useState<Sale | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null);
  const { viewMode, setViewMode } = useAppStore();

  useEffect(() => {
    db.customers.toArray().then((arr) => {
      const map: Record<string, Customer> = {};
      arr.filter((c) => !c.deleted).forEach((c) => { map[c.id] = c; });
      setCustomers(map);
    });
  }, []);

  useEffect(() => {
    db.saleDetails.toArray().then((arr) => {
      const map: Record<string, SaleDetail[]> = {};
      arr.forEach((d) => { (map[d.saleId] ??= []).push(d); });
      setDetailsBySale(map);
    });
  }, []);

  const enriched = useMemo(() => {
    return sales.map((s) => ({
      ...s,
      customerName: customers[s.customerId]?.name ?? "Cliente eliminado",
      detailLabels: (detailsBySale[s.id] ?? []).map((d) => `${d.code} ${d.name} ${d.color}`),
    }));
  }, [sales, customers, detailsBySale]);

  const filtered = useMemo(() => {
    return filterSales(enriched, {
      search,
      status: filterStatus,
      paymentMethod: filterPayment,
      dateFrom: filterDateFrom,
      dateTo: filterDateTo,
    });
  }, [enriched, search, filterStatus, filterPayment, filterDateFrom, filterDateTo]);

  const hasActiveFilters = !!(filterStatus !== "all" || filterPayment || filterDateFrom || filterDateTo);

  const handleVoid = async () => {
    if (!voidTarget) return;
    try {
      await voidById(voidTarget.id);
      toast.success(voidTarget.status === "confirmada" ? "Venta anulada (inventario restaurado)" : "Venta anulada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo anular la venta");
    }
    setVoidTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await remove(deleteTarget.id);
    toast.success("Venta enviada a la papelera");
    setDeleteTarget(null);
  };

  const statusBadge = (s: Sale) => (
    <span className={`text-xs px-2 py-0.5 rounded-full ${
      s.status === "confirmada" ? "bg-emerald-600/20 text-emerald-400" :
      s.status === "pendiente" ? "bg-amber-600/20 text-amber-400" :
      "bg-red-600/20 text-red-400"
    }`}>
      {s.status === "confirmada" ? "Confirmada" : s.status === "pendiente" ? "Pendiente" : "Anulada"}
    </span>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Ventas</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === "card" ? "list" : "card")}
            className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400 transition-colors"
          >
            {viewMode === "card" ? <LayoutList size={18} /> : <LayoutGrid size={18} />}
          </button>
          <Link href="/sales/new">
            <Button size="sm"><Plus size={16} /> Nueva venta</Button>
          </Link>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por código, cliente o producto..." className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl pl-9 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-purple-500/50"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button onClick={() => setFilterStatus("all")}
          className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${filterStatus === "all" ? "bg-purple-600 text-white" : "bg-zinc-800 text-zinc-400"}`}
        >Todas</button>
        {SALE_STATUSES.map((st) => (
          <button key={st} onClick={() => setFilterStatus(st)}
            className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${filterStatus === st ? "bg-purple-600 text-white" : "bg-zinc-800 text-zinc-400"}`}
          >{st === "confirmada" ? "Confirmadas" : st === "pendiente" ? "Pendientes" : "Anuladas"}</button>
        ))}
      </div>

      <div className="flex items-center gap-2 rounded-xl bg-zinc-800/30 border border-zinc-700/40 p-2">
        <CalendarRange size={16} className="text-zinc-500 ml-1 shrink-0" />
        <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)}
          className="flex-1 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-purple-500/50" />
        <span className="text-xs text-zinc-500">a</span>
        <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)}
          className="flex-1 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-purple-500/50" />
        <select value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)}
          className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-purple-500/50">
          <option value="">Todos los pagos</option>
          {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        {hasActiveFilters && (
          <button onClick={() => { setFilterStatus("all"); setFilterPayment(""); setFilterDateFrom(""); setFilterDateTo(""); }}
            className="text-xs px-2 py-1 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 shrink-0"
          >Limpiar</button>
        )}
      </div>

      <Modal open={!!voidTarget} onClose={() => setVoidTarget(null)} title="Anular Venta">
        <p className="text-zinc-400 mb-4">
          ¿Anular la venta <strong className="text-zinc-200">{voidTarget?.code}</strong> por <strong className="text-zinc-200">{formatCurrency(voidTarget?.total || 0)}</strong>?
          {voidTarget?.status === "confirmada" && " El inventario será restaurado automáticamente."}
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setVoidTarget(null)}>Cancelar</Button>
          <Button variant="danger" className="flex-1" onClick={handleVoid}>Anular</Button>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar Venta">
        <p className="text-zinc-400 mb-4">¿Enviar la venta <strong className="text-zinc-200">{deleteTarget?.code}</strong> a la papelera? Puedes recuperarla desde ahí.</p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button variant="danger" className="flex-1" onClick={handleDelete}>Eliminar</Button>
        </div>
      </Modal>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-zinc-800/50 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ReceiptText size={40} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-600 text-lg">No hay ventas registradas</p>
          <p className="text-zinc-700 text-sm mt-1">Registra tu primera venta para verla aquí.</p>
        </div>
      ) : viewMode === "card" ? (
        <div className="space-y-3">
          {filtered.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="group rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-4 hover:border-zinc-700/60 transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {statusBadge(s)}
                    {s.status === "confirmada" && <CheckCircle2 size={14} className="text-emerald-400" />}
                  </div>
                  <Link href={`/sales/${s.id}`} className="block mt-1.5">
                    <h3 className="font-medium text-zinc-100">{s.code} · {s.customerName}</h3>
                  </Link>
                </div>
                <p className="text-lg font-semibold text-zinc-100 ml-3">{formatCurrency(s.total)}</p>
              </div>

              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <span>{PAYMENT_LABELS[s.paymentMethod]}</span>
                <span>{formatDate(s.date)}</span>
                <span className="truncate">{(detailsBySale[s.id] ?? []).length} ítems</span>
              </div>

              <div className="flex items-center gap-1 mt-3">
                <div className="flex-1" />
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {canEditSale(s.status) && (
                    <Link href={`/sales/edit/${s.id}`}>
                      <button className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300">
                        <Edit2 size={14} />
                      </button>
                    </Link>
                  )}
                  {canVoidSale(s.status) && (
                    <button onClick={() => setVoidTarget(s)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400">
                      <Ban size={14} />
                    </button>
                  )}
                  <button onClick={() => setDeleteTarget(s)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}>
              <Link href={`/sales/${s.id}`}
                className="flex items-center gap-3 rounded-xl bg-zinc-900/40 border border-zinc-800/40 px-4 py-3 hover:bg-zinc-800/40 transition-colors"
              >
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                  s.status === "confirmada" ? "bg-emerald-500" :
                  s.status === "pendiente" ? "bg-amber-500" :
                  "bg-red-500"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200 truncate">{s.code} · {s.customerName}</p>
                  <div className="flex items-center gap-2 text-xs text-zinc-600 mt-0.5">
                    <span>{PAYMENT_LABELS[s.paymentMethod]}</span>
                    <span>{formatDate(s.date)}</span>
                  </div>
                </div>
                <p className="text-sm font-semibold text-zinc-100">{formatCurrency(s.total)}</p>
              </Link>
              <div className="flex items-center justify-end gap-1 px-4 pb-1">
                {canEditSale(s.status) && (
                  <Link href={`/sales/edit/${s.id}`} className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-zinc-300 opacity-0 hover:opacity-100 transition-opacity">
                    <Edit2 size={12} />
                  </Link>
                )}
                {canVoidSale(s.status) && (
                  <button onClick={() => setVoidTarget(s)} className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-red-400 opacity-0 hover:opacity-100 transition-opacity">
                    <Ban size={12} />
                  </button>
                )}
                <button onClick={() => setDeleteTarget(s)} className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-red-400 opacity-0 hover:opacity-100 transition-opacity">
                  <Trash2 size={12} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default function SalesPage() {
  return (
    <Suspense fallback={<div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-zinc-800/50 animate-pulse" />)}</div>}>
      <SalesContent />
    </Suspense>
  );
}
