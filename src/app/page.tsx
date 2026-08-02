"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Wallet, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight, Plus } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { useExpenses } from "@/features/expenses/hooks/useExpenses";
import { formatCurrency } from "@/utils/format";
import { useTranslation } from "@/hooks/useTranslation";
import type { Category } from "@/types";

export default function HomePage() {
  const { t: _ } = useTranslation();
  const { expenses } = useExpenses();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    db.categories.toArray().then(setCategories);
  }, []);

  const total = expenses.reduce((s, e) => s + (e.totalAmount || e.amount), 0);
  const avg = expenses.length ? total / expenses.length : 0;
  const todayExpenses = expenses.filter((e) => e.date === new Date().toISOString().split("T")[0]);
  const todayTotal = todayExpenses.reduce((s, e) => s + (e.totalAmount || e.amount), 0);
  const lastExpense = expenses[0];
  const topCategory = categories
    .map((c) => ({
      name: c.name,
      total: expenses.filter((e) => e.categoryId === c.id).reduce((s, e) => s + (e.totalAmount || e.amount), 0),
      color: c.color,
    }))
    .sort((a, b) => b.total - a.total)[0];

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
  const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{_("home.title")}</h1>
          <p className="text-sm text-zinc-500">{new Date().toLocaleDateString("es-EC", { dateStyle: "full" })}</p>
        </div>
        <Link href="/expenses/new"
          className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-600/30"
        >
          <Plus size={24} className="text-white" />
        </Link>
      </motion.div>

      <motion.div variants={item} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600/20 via-zinc-900 to-pink-600/10 border border-zinc-800 p-5">
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/10 rounded-full blur-3xl" />
        <p className="text-sm text-zinc-400">{_("home.todayExpenses")}</p>
        <p className="text-3xl font-bold mt-1">{formatCurrency(todayTotal)}</p>
        <p className="text-xs text-zinc-500 mt-1">{todayExpenses.length} {_("home.recordsToday")}</p>
      </motion.div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: _("home.totalSpent"), value: formatCurrency(total), icon: Wallet, color: "from-blue-600/20 to-blue-900/20" },
          { label: _("home.avgPerRecord"), value: formatCurrency(avg), icon: TrendingUp, color: "from-emerald-600/20 to-emerald-900/20" },
          { label: _("home.totalRecords"), value: expenses.length.toString(), icon: Calendar, color: "from-amber-600/20 to-amber-900/20" },
          { label: topCategory?.name || _("expenses.withoutCategory"), value: topCategory ? formatCurrency(topCategory.total) : "-", icon: ArrowUpRight, color: "from-purple-600/20 to-purple-900/20" },
        ].map((card) => (
          <motion.div key={card.label} variants={item}
            className={`rounded-2xl bg-gradient-to-br ${card.color} border border-zinc-800 p-4 space-y-2`}
          >
            <card.icon size={18} className="text-zinc-400" />
            <p className="text-xs text-zinc-500">{card.label}</p>
            <p className="text-lg font-semibold truncate">{card.value}</p>
          </motion.div>
        ))}
      </div>

      {lastExpense && (
        <motion.div variants={item} className="rounded-2xl bg-zinc-900/50 border border-zinc-800 p-4">
          <p className="text-xs text-zinc-500 mb-2">{_("home.lastExpense")}</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{lastExpense.name}</p>
              <p className="text-xs text-zinc-500">{lastExpense.code} • {lastExpense.date}</p>
            </div>
            <p className="text-lg font-semibold text-purple-400">{formatCurrency(lastExpense.totalAmount || lastExpense.amount)}</p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
