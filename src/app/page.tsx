"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  TrendingUp, Wallet, Truck, Briefcase, Package, PackageX, ShoppingBag, Plus,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RPieChart, Pie, Cell,
} from "recharts";
import { useDashboard } from "@/features/dashboard/hooks/useDashboard";
import { SyncStatusBadge } from "@/features/dashboard/components/SyncStatusBadge";
import { formatCurrency } from "@/utils/format";

const CHART_COLORS = ["#a855f7", "#ec4899", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#78716c"];

export default function HomePage() {
  const { data, loading } = useDashboard();

  if (loading || !data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const metrics = [
    {
      label: "Ventas de la semana",
      value: formatCurrency(data.salesWeek),
      sub: `${data.salesCountWeek} ventas`,
      icon: TrendingUp,
      color: "from-emerald-600/15 to-emerald-900/10",
      iconColor: "text-emerald-400",
      href: "/sales",
    },
    {
      label: "Compras",
      value: formatCurrency(data.purchasesTotal),
      sub: `${data.purchasesCount} compras`,
      icon: Truck,
      color: "from-sky-600/15 to-sky-900/10",
      iconColor: "text-sky-400",
      href: "/purchases",
    },
    {
      label: "Gastos",
      value: formatCurrency(data.expensesTotal),
      sub: `${data.expensesCount} registros`,
      icon: Wallet,
      color: "from-rose-600/15 to-rose-900/10",
      iconColor: "text-rose-400",
      href: "/expenses",
    },
    {
      label: "Inversiones",
      value: formatCurrency(data.investmentsTotal),
      sub: `${data.investmentsCount} inversiones`,
      icon: Briefcase,
      color: "from-cyan-600/15 to-cyan-900/10",
      iconColor: "text-cyan-400",
      href: "/investments",
    },
    {
      label: "Productos vendidos",
      value: `${data.unitsSold}`,
      sub: "unidades confirmadas",
      icon: Package,
      color: "from-purple-600/15 to-purple-900/10",
      iconColor: "text-purple-400",
      href: "/sales",
    },
    {
      label: "Stock bajo",
      value: `${data.lowStockCount}`,
      sub: "productos con ≤ 5 unidades",
      icon: PackageX,
      color: "from-amber-600/15 to-amber-900/10",
      iconColor: "text-amber-400",
      href: "/products",
    },
  ];

  const maxTopUnits = Math.max(...data.topProducts.map((p) => p.units), 1);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Dashboard</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{new Date().toLocaleDateString("es-EC", { dateStyle: "full" })}</p>
        </div>
        <div className="flex items-center gap-2">
          <SyncStatusBadge />
          <Link href="/sales/new" className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-600/30 shrink-0">
            <Plus size={20} className="text-white" />
          </Link>
        </div>
      </div>

      <Link href="/sales">
        <motion.div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600/20 via-zinc-900 to-teal-600/10 border border-zinc-800 p-5">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-600/10 rounded-full blur-3xl" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-400">Ventas de hoy</p>
              <p className="text-3xl font-bold mt-1">{formatCurrency(data.salesToday)}</p>
              <p className="text-xs text-zinc-500 mt-1">{data.salesCountToday} ventas confirmadas</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 flex items-center justify-center">
              <ShoppingBag size={22} className="text-emerald-400" />
            </div>
          </div>
        </motion.div>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        {metrics.map((m) => (
          <Link key={m.label} href={m.href}>
            <motion.div
              className={`rounded-2xl bg-gradient-to-br ${m.color} border border-zinc-800 p-4 space-y-2 h-full`}
            >
              <m.icon size={18} className={m.iconColor} />
              <p className="text-xs text-zinc-500">{m.label}</p>
              <p className="text-lg font-semibold truncate">{m.value}</p>
              <p className="text-[11px] text-zinc-600">{m.sub}</p>
            </motion.div>
          </Link>
        ))}
      </div>

      <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800 p-4">
        <p className="text-sm font-semibold text-zinc-100 mb-3">Ventas por día</p>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.salesByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} width={42} />
              <Tooltip
                cursor={{ fill: "#27272a44" }}
                contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: "12px", color: "#f4f4f5" }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Bar dataKey="total" fill="#a855f7" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800 p-4">
        <p className="text-sm font-semibold text-zinc-100 mb-3">Ventas por categoría</p>
        {data.salesByCategory.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-8">Sin ventas en este período</p>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <RPieChart>
                <Pie data={data.salesByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                  {data.salesByCategory.map((entry, i) => (
                    <Cell key={i} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: "12px", color: "#f4f4f5" }}
                  formatter={(value: number) => formatCurrency(value)}
                />
              </RPieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800 p-4">
        <p className="text-sm font-semibold text-zinc-100 mb-3">Productos más vendidos</p>
        {data.topProducts.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-8">Sin ventas en este período</p>
        ) : (
          <div className="space-y-3">
            {data.topProducts.map((p, i) => (
              <div key={`${p.code}-${i}`} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-200 truncate">
                    <span className="text-zinc-500 mr-1.5">#{i + 1}</span>
                    {p.name} <span className="text-zinc-600">({p.code})</span>
                  </span>
                  <span className="text-zinc-400 shrink-0 ml-2">
                    {p.units} ud · {formatCurrency(p.revenue)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div className="h-full rounded-full bg-purple-500" style={{ width: `${(p.units / maxTopUnits) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
