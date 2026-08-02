"use client";
import { Suspense, useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Edit2, Trash2, Copy, Share2, ChevronDown, ChevronRight, LayoutList, LayoutGrid } from "lucide-react";
import { useExpenses } from "@/features/expenses/hooks/useExpenses";
import { useAppStore } from "@/stores/useAppStore";
import { useTranslation } from "@/hooks/useTranslation";
import { formatCurrency, formatDate } from "@/utils/format";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import toast from "react-hot-toast";
import Link from "next/link";
import type { Expense, ExpenseDetail, Category, Type } from "@/types";

function ExpensesContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";
  const { expenses, loading, remove, duplicate } = useExpenses();
  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [types, setTypes] = useState<Record<string, Type>>({});
  const [search, setSearch] = useState(q);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterType, setFilterType] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailsMap, setDetailsMap] = useState<Record<string, ExpenseDetail[]>>({});
  const { viewMode, setViewMode } = useAppStore();
  const { t: _ } = useTranslation();

  useEffect(() => {
    db.categories.toArray().then((arr) => {
      const map: Record<string, Category> = {};
      arr.forEach((c) => { map[c.id] = c; });
      setCategories(map);
    });
    db.types.toArray().then((arr) => {
      const map: Record<string, Type> = {};
      arr.forEach((t) => { map[t.id] = t; });
      setTypes(map);
    });
  }, []);

  const filtered = useMemo(() => {
    let items = expenses;
    if (search) {
      const s = search.toLowerCase();
      items = items.filter((e) =>
        e.code.toLowerCase().includes(s) ||
        e.name.toLowerCase().includes(s) ||
        e.description.toLowerCase().includes(s) ||
        categories[e.categoryId]?.name.toLowerCase().includes(s) ||
        types[e.typeId]?.name.toLowerCase().includes(s) ||
        e.amount.toString().includes(s)
      );
    }
    if (filterCategory) items = items.filter((e) => e.categoryId === filterCategory);
    if (filterType) items = items.filter((e) => e.typeId === filterType);
    return items;
  }, [expenses, search, filterCategory, filterType, categories, types]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await remove(deleteTarget.id);
    toast.success("Gasto eliminado");
    setDeleteTarget(null);
  };

  const handleShare = async (e: Expense) => {
    const text = `Gasto ${e.code}: ${e.name} - ${formatCurrency(e.totalAmount || e.amount)} (${e.date})`;
    if (navigator.share) {
      await navigator.share({ title: "Zane - Gasto", text });
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Copiado al portapapeles");
    }
  };

  const toggleExpand = async (expenseId: string) => {
    if (expandedId === expenseId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(expenseId);
    if (!detailsMap[expenseId]) {
      const details = await db.expenseDetails.where({ expenseId }).toArray();
      setDetailsMap((prev) => ({ ...prev, [expenseId]: details }));
    }
  };

  const allCategories = Object.values(categories);
  const allTypes = Object.values(types);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{_("expenses.title")}</h1>
        <button
          onClick={() => setViewMode(viewMode === "card" ? "list" : "card")}
          className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400 transition-colors"
          title={viewMode === "card" ? "Vista lista" : "Vista tarjetas"}
        >
          {viewMode === "card" ? <LayoutList size={18} /> : <LayoutGrid size={18} />}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={_("expenses.search")} className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl pl-9 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-purple-500/50"
          />
        </div>
        <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar Gasto">
          <p className="text-zinc-400 mb-4">¿Eliminar el gasto <strong className="text-zinc-200">{deleteTarget?.name}</strong>?</p>
          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="danger" className="flex-1" onClick={handleDelete}>Eliminar</Button>
          </div>
        </Modal>
      </div>

      {(filterCategory || filterType) && (
        <div className="flex gap-2 flex-wrap">
          {filterCategory && (
            <button onClick={() => setFilterCategory("")}
              className="text-xs px-3 py-1 rounded-full bg-purple-600/20 text-purple-400 border border-purple-600/30"
            >
              {categories[filterCategory]?.name} ✕
            </button>
          )}
          {filterType && (
            <button onClick={() => setFilterType("")}
              className="text-xs px-3 py-1 rounded-full bg-purple-600/20 text-purple-400 border border-purple-600/30"
            >
              {types[filterType]?.name} ✕
            </button>
          )}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button onClick={() => { setFilterCategory(""); setFilterType(""); }}
          className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${!filterCategory && !filterType ? "bg-purple-600 text-white" : "bg-zinc-800 text-zinc-400"}`}
        >{_("expenses.all")}</button>
        {allCategories.slice(0, 5).map((c) => (
          <button key={c.id} onClick={() => { setFilterCategory(c.id); setFilterType(""); }}
            className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${filterCategory === c.id ? "bg-purple-600 text-white" : "bg-zinc-800 text-zinc-400"}`}
          >{c.icon} {c.name}</button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-zinc-800/50 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-zinc-600 text-lg">{_("expenses.noExpenses")}</p>
          <p className="text-zinc-700 text-sm mt-1">{_("expenses.firstExpense")}</p>
        </div>
      ) : viewMode === "card" ? (
          <div className="space-y-3">
            {filtered.map((expense, i) => (
              <motion.div
                key={expense.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="group rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-4 hover:border-zinc-700/60 transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-purple-500 bg-purple-600/10 px-2 py-0.5 rounded-md">{expense.code}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        expense.status === "pagado" ? "bg-emerald-600/20 text-emerald-400" :
                        expense.status === "pendiente" ? "bg-amber-600/20 text-amber-400" :
                        expense.status === "cancelado" ? "bg-red-600/20 text-red-400" :
                        "bg-blue-600/20 text-blue-400"
                      }`}>{expense.status}</span>
                      {expense.hasDetails && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-600/10 text-purple-500 border border-purple-600/20">
                          Detalle
                        </span>
                      )}
                    </div>
                    <Link href={`/expenses/${expense.id}`} className="block mt-1.5">
                      <h3 className="font-medium text-zinc-100 truncate">{expense.name}</h3>
                    </Link>
                  </div>
                  <p className="text-lg font-semibold text-zinc-100 ml-3">{formatCurrency(expense.totalAmount || expense.amount)}</p>
                </div>

                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <span>{categories[expense.categoryId]?.icon} {categories[expense.categoryId]?.name || "Sin categoría"}</span>
                  <span>{types[expense.typeId]?.name || "Sin tipo"}</span>
                  <span>{formatDate(expense.date)}</span>
                </div>

                <div className="flex items-center gap-1 mt-3">
                  <button
                    onClick={() => toggleExpand(expense.id)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      expandedId === expense.id
                        ? "bg-purple-600/20 text-purple-400"
                        : "hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {expandedId === expense.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  <div className="flex-1" />
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link href={`/expenses/edit/${expense.id}`}>
                      <button className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300">
                        <Edit2 size={14} />
                      </button>
                    </Link>
                    <button onClick={() => setDeleteTarget(expense)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400">
                      <Trash2 size={14} />
                    </button>
                    <button onClick={() => duplicate(expense)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300">
                      <Copy size={14} />
                    </button>
                    <button onClick={() => handleShare(expense)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300">
                      <Share2 size={14} />
                    </button>
                  </div>
                </div>
                <AnimatePresence>
                  {expandedId === expense.id && detailsMap[expense.id] && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 pt-3 border-t border-zinc-800/60 space-y-2">
                        {detailsMap[expense.id].length === 0 ? (
                          <p className="text-xs text-zinc-600 text-center py-2">Sin conceptos registrados</p>
                        ) : (
                          detailsMap[expense.id].map((d) => (
                            <div key={d.id} className="flex items-center justify-between text-xs">
                              <div className="flex-1 min-w-0">
                                <p className="text-zinc-300 truncate">{d.productName}</p>
                                <p className="text-zinc-600">{d.quantity} x {formatCurrency(d.unitPrice)}</p>
                              </div>
                              <p className="text-zinc-300 font-mono ml-2">{formatCurrency(d.subtotal)}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((expense, i) => (
              <motion.div
                key={expense.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
              >
                <Link href={`/expenses/${expense.id}`}
                  className="flex items-center gap-3 rounded-xl bg-zinc-900/40 border border-zinc-800/40 px-4 py-3 hover:bg-zinc-800/40 transition-colors"
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    expense.status === "pagado" ? "bg-emerald-500" :
                    expense.status === "pendiente" ? "bg-amber-500" :
                    expense.status === "cancelado" ? "bg-red-500" :
                    "bg-blue-500"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-purple-500">{expense.code}</span>
                      <p className="text-sm font-medium text-zinc-200 truncate">{expense.name}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-600 mt-0.5">
                      <span>{categories[expense.categoryId]?.icon} {categories[expense.categoryId]?.name || "Sin categoría"}</span>
                      <span>{formatDate(expense.date)}</span>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-zinc-100">{formatCurrency(expense.totalAmount || expense.amount)}</p>
                </Link>
                <div className="flex items-center justify-end gap-1 px-4 pb-1">
                  <button onClick={() => setDeleteTarget(expense)} className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-red-400 opacity-0 hover:opacity-100 transition-opacity">
                    <Trash2 size={12} />
                  </button>
                  <button onClick={() => duplicate(expense)} className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-zinc-300 opacity-0 hover:opacity-100 transition-opacity">
                    <Copy size={12} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
    </motion.div>
  );
}

export default function ExpensesPage() {
  return (
    <Suspense fallback={<div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-24 rounded-2xl bg-zinc-800/50 animate-pulse" />)}</div>}>
      <ExpensesContent />
    </Suspense>
  );
}
