"use client";
import { Suspense, useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Search, Edit2, Trash2, Ban, CalendarRange, LayoutList, LayoutGrid, Briefcase } from "lucide-react";
import { useInvestments } from "@/features/investments/hooks/useInvestments";
import { useAppStore } from "@/stores/useAppStore";
import { useTranslation } from "@/hooks/useTranslation";
import { formatCurrency, formatDate } from "@/utils/format";
import { filterInvestments, canEditInvestment, canVoidInvestment } from "@/features/investments/domain/investmentRules";
import { db } from "@/lib/db";
import type { TranslationPath } from "@/lib/translations";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import toast from "react-hot-toast";
import Link from "next/link";
import type { Investment, InvestmentCategory } from "@/types";

function InvestmentsContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";
  const { investments, loading, remove, voidById } = useInvestments();
  const [categories, setCategories] = useState<Record<string, InvestmentCategory>>({});
  const [search, setSearch] = useState(q);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [voidTarget, setVoidTarget] = useState<Investment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Investment | null>(null);
  const { viewMode, setViewMode } = useAppStore();
  const { t: _ } = useTranslation();

  useEffect(() => {
    db.investmentCategories.toArray().then((arr) => {
      const map: Record<string, InvestmentCategory> = {};
      arr.forEach((c) => { map[c.id] = c; });
      setCategories(map);
    });
  }, []);

  const categoryNames = useMemo(() => {
    const map: Record<string, string> = {};
    Object.values(categories).forEach((c) => { map[c.id] = c.name; });
    return map;
  }, [categories]);

  const filtered = useMemo(() => {
    return filterInvestments(investments, { search, categoryId: filterCategory, dateFrom: filterDateFrom, dateTo: filterDateTo }, categoryNames);
  }, [investments, search, filterCategory, filterDateFrom, filterDateTo, categoryNames]);

  const hasActiveFilters = !!(filterCategory || filterDateFrom || filterDateTo);

  const handleVoid = async () => {
    if (!voidTarget) return;
    try {
      await voidById(voidTarget.id);
      toast.success("Inversión anulada");
    } catch {
      toast.error("No se pudo anular la inversión");
    }
    setVoidTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await remove(deleteTarget.id);
    toast.success("Inversión eliminada");
    setDeleteTarget(null);
  };

  const allCategories = Object.values(categories);
  const statusBadge = (inv: Investment) => (
    <span className={`text-xs px-2 py-0.5 rounded-full ${
      inv.status === "pagado" ? "bg-emerald-600/20 text-emerald-400" :
      inv.status === "pendiente" ? "bg-amber-600/20 text-amber-400" :
      "bg-red-600/20 text-red-400"
    }`}>{_(`status.${inv.status}` as TranslationPath)}</span>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{_("investments.title")}</h1>
        <button
          onClick={() => setViewMode(viewMode === "card" ? "list" : "card")}
          className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400 transition-colors"
          title={viewMode === "card" ? _("investments.viewList") : _("investments.viewCards")}
        >
          {viewMode === "card" ? <LayoutList size={18} /> : <LayoutGrid size={18} />}
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={_("investments.search")} className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl pl-9 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-purple-500/50"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button onClick={() => setFilterCategory("")}
          className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${!filterCategory ? "bg-purple-600 text-white" : "bg-zinc-800 text-zinc-400"}`}
        >{_("investments.all")}</button>
        {allCategories.map((c) => (
          <button key={c.id} onClick={() => setFilterCategory(c.id)}
            className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${filterCategory === c.id ? "bg-purple-600 text-white" : "bg-zinc-800 text-zinc-400"}`}
          >{c.icon} {c.name}</button>
        ))}
      </div>

      <div className="flex items-center gap-2 rounded-xl bg-zinc-800/30 border border-zinc-700/40 p-2">
        <CalendarRange size={16} className="text-zinc-500 ml-1 shrink-0" />
        <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)}
          className="flex-1 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-purple-500/50" />
        <span className="text-xs text-zinc-500">a</span>
        <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)}
          className="flex-1 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-purple-500/50" />
        {hasActiveFilters && (
          <button onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); setFilterCategory(""); }}
            className="text-xs px-2 py-1 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 shrink-0"
          >{_("investments.clearFilters")}</button>
        )}
      </div>

      <Modal open={!!voidTarget} onClose={() => setVoidTarget(null)} title="Anular Inversión">
        <p className="text-zinc-400 mb-4">¿Anular la inversión <strong className="text-zinc-200">{voidTarget?.name}</strong> por <strong className="text-zinc-200">{formatCurrency(voidTarget?.value || 0)}</strong>? Una inversión anulada no puede editarse.</p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setVoidTarget(null)}>Cancelar</Button>
          <Button variant="danger" className="flex-1" onClick={handleVoid}>Anular</Button>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar Inversión">
        <p className="text-zinc-400 mb-4">¿Enviar la inversión <strong className="text-zinc-200">{deleteTarget?.name}</strong> a la papelera? Puedes recuperarla desde ahí.</p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button variant="danger" className="flex-1" onClick={handleDelete}>{_("common.delete")}</Button>
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
          <Briefcase size={40} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-600 text-lg">{_("investments.noInvestments")}</p>
          <p className="text-zinc-700 text-sm mt-1">{_("investments.firstInvestment")}</p>
        </div>
      ) : viewMode === "card" ? (
        <div className="space-y-3">
          {filtered.map((inv, i) => (
            <motion.div
              key={inv.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="group rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-4 hover:border-zinc-700/60 transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {statusBadge(inv)}
                  </div>
                  <Link href={`/investments/${inv.id}`} className="block mt-1.5">
                    <h3 className="font-medium text-zinc-100 truncate">{inv.name}</h3>
                  </Link>
                </div>
                <p className="text-lg font-semibold text-zinc-100 ml-3">{formatCurrency(inv.value)}</p>
              </div>

              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <span>{categories[inv.categoryId]?.icon} {categories[inv.categoryId]?.name || _("investments.withoutCategory")}</span>
                {inv.supplier && <span className="truncate">{inv.supplier}</span>}
                <span>{formatDate(inv.date)}</span>
              </div>

              <div className="flex items-center gap-1 mt-3">
                <div className="flex-1" />
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {canEditInvestment(inv.status) && (
                    <Link href={`/investments/edit/${inv.id}`}>
                      <button className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300">
                        <Edit2 size={14} />
                      </button>
                    </Link>
                  )}
                  {canVoidInvestment(inv.status) && (
                    <button onClick={() => setVoidTarget(inv)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400">
                      <Ban size={14} />
                    </button>
                  )}
                  <button onClick={() => setDeleteTarget(inv)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((inv, i) => (
            <motion.div key={inv.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}>
              <Link href={`/investments/${inv.id}`}
                className="flex items-center gap-3 rounded-xl bg-zinc-900/40 border border-zinc-800/40 px-4 py-3 hover:bg-zinc-800/40 transition-colors"
              >
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                  inv.status === "pagado" ? "bg-emerald-500" :
                  inv.status === "pendiente" ? "bg-amber-500" :
                  "bg-red-500"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200 truncate">{inv.name}</p>
                  <div className="flex items-center gap-2 text-xs text-zinc-600 mt-0.5">
                    <span>{categories[inv.categoryId]?.icon} {categories[inv.categoryId]?.name || _("investments.withoutCategory")}</span>
                    <span>{formatDate(inv.date)}</span>
                  </div>
                </div>
                <p className="text-sm font-semibold text-zinc-100">{formatCurrency(inv.value)}</p>
              </Link>
              <div className="flex items-center justify-end gap-1 px-4 pb-1">
                {canEditInvestment(inv.status) && (
                  <Link href={`/investments/edit/${inv.id}`} className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-zinc-300 opacity-0 hover:opacity-100 transition-opacity">
                    <Edit2 size={12} />
                  </Link>
                )}
                {canVoidInvestment(inv.status) && (
                  <button onClick={() => setVoidTarget(inv)} className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-red-400 opacity-0 hover:opacity-100 transition-opacity">
                    <Ban size={12} />
                  </button>
                )}
                <button onClick={() => setDeleteTarget(inv)} className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-red-400 opacity-0 hover:opacity-100 transition-opacity">
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

export default function InvestmentsPage() {
  return (
    <Suspense fallback={<div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-zinc-800/50 animate-pulse" />)}</div>}>
      <InvestmentsContent />
    </Suspense>
  );
}
