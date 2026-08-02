"use client";
import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { BarChart3, PieChart, TrendingUp, Calendar, Printer, FileSpreadsheet, Share2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RPieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import { db } from "@/lib/db";
import { useExpenses } from "@/features/expenses/hooks/useExpenses";
import { PERIODS as periods, getDateRange } from "@/features/reports/services/reportService";
import { formatCurrency } from "@/utils/format";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";
import type { Category, PeriodFilter, Expense, ExpenseDetail } from "@/types";

const CHART_COLORS = ["#a855f7","#ec4899","#f97316","#eab308","#22c55e","#06b6d4","#3b82f6","#78716c"];

export default function ReportsPage() {
  const { expenses } = useExpenses();
  const [categories, setCategories] = useState<Category[]>([]);
  const [detailsMap, setDetailsMap] = useState<Record<string, ExpenseDetail[]>>({});
  const [period, setPeriod] = useState<PeriodFilter>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [chartType, setChartType] = useState<"bar" | "pie" | "line">("bar");

  useEffect(() => {
    db.categories.toArray().then(setCategories);
  }, []);

  const filtered = useMemo(() => {
    if (period === "custom" && customStart && customEnd) {
      const s = new Date(customStart);
      const e = new Date(customEnd);
      e.setHours(23, 59, 59, 999);
      return expenses.filter((ex) => {
        const [y, m, d2] = ex.date.split('-').map(Number);
        const d = new Date(y, m - 1, d2);
        return d >= s && d <= e;
      });
    }
    if (period === "custom") return expenses;
    const { start, end } = getDateRange(period);
    return expenses.filter((ex) => {
      const [y, m, d2] = ex.date.split('-').map(Number);
      const d = new Date(y, m - 1, d2);
      return d >= start && d <= end;
    });
  }, [expenses, period, customStart, customEnd]);

  useEffect(() => {
    const ids = filtered.map((e) => e.id);
    if (!ids.length) { setDetailsMap({}); return; }
    db.expenseDetails.where("expenseId").anyOf(ids).toArray().then((list) => {
      const map: Record<string, ExpenseDetail[]> = {};
      list.forEach((d) => {
        (map[d.expenseId] = map[d.expenseId] || []).push(d);
      });
      setDetailsMap(map);
    });
  }, [filtered]);

  const totalAmount = filtered.reduce((s, e) => s + (e.totalAmount || e.amount), 0);
  const count = filtered.length;
  const avg = count ? totalAmount / count : 0;

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((e) => { map[e.categoryId] = (map[e.categoryId] || 0) + (e.totalAmount || e.amount); });
    return Object.entries(map)
      .map(([id, amount]) => ({
        name: categories.find((c) => c.id === id)?.name || "Sin categoría",
        value: amount,
        color: categories.find((c) => c.id === id)?.color || "#78716c",
      }))
      .sort((a, b) => b.value - a.value);
  }, [filtered, categories]);

  const byDate = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((e) => {
      const d = e.date;
      map[d] = (map[d] || 0) + (e.totalAmount || e.amount);
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({ date, amount }));
  }, [filtered]);

  const topCategory = byCategory[0];

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name || "Sin categoría";

  const periodLabel = periods.find((p) => p.value === period)?.label || "Personalizado";

  const rangeText = useMemo(() => {
    if (period === "custom" && customStart && customEnd) return `${customStart} al ${customEnd}`;
    const { start, end } = getDateRange(period);
    return `${start.toLocaleDateString("es-EC")} al ${end.toLocaleDateString("es-EC")}`;
  }, [period, customStart, customEnd]);

  const buildRows = () => {
    const rows: Record<string, string | number>[] = [];
    filtered.forEach((ex) => {
      const details = detailsMap[ex.id] || [];
      const amount = ex.totalAmount || ex.amount;
      if (details.length) {
        details.forEach((d) => {
          rows.push({
            Fecha: ex.date,
            Código: ex.code,
            Gasto: ex.name,
            Categoría: categoryName(ex.categoryId),
            Concepto: d.productName,
            Cantidad: d.quantity,
            "Precio Unitario": d.unitPrice,
            Subtotal: d.subtotal,
          });
        });
      } else {
        rows.push({
          Fecha: ex.date,
          Código: ex.code,
          Gasto: ex.name,
          Categoría: categoryName(ex.categoryId),
          Concepto: "",
          Cantidad: "",
          "Precio Unitario": "",
          Subtotal: amount,
        });
      }
    });
    return rows;
  };

  const buildSummaryText = () => {
    const lines: string[] = [];
    lines.push(`Reporte de Gastos - ${periodLabel} (${rangeText})`);
    lines.push(`Total: ${formatCurrency(totalAmount)} | Registros: ${count}`);
    lines.push("--------------------------------");
    filtered.forEach((ex) => {
      const details = detailsMap[ex.id] || [];
      lines.push(`${ex.date} ${ex.code} - ${ex.name} (${categoryName(ex.categoryId)})`);
      if (details.length) {
        details.forEach((d) => {
          lines.push(`   ${d.quantity} x ${formatCurrency(d.unitPrice)} - ${d.productName}: ${formatCurrency(d.subtotal)}`);
        });
      } else {
        lines.push(`   ${formatCurrency(ex.totalAmount || ex.amount)}`);
      }
    });
    lines.push("--------------------------------");
    lines.push(`TOTAL: ${formatCurrency(totalAmount)}`);
    return lines.join("\n");
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const rows = buildRows();
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Reporte");
      XLSX.writeFile(wb, `reporte_gastos_${periodLabel.toLowerCase().replace(/\s+/g, "_")}.xlsx`);
      toast.success("Excel descargado");
    } catch (err) {
      console.error(err);
      toast.error("No se pudo generar el Excel");
    }
  };

  const handleShare = async () => {
    const text = buildSummaryText();
    const shareData: ShareData = { title: `Reporte de Gastos - ${periodLabel}`, text };
    if (navigator.canShare && navigator.canShare({ files: [] as File[] })) {
      try {
        const XLSX = await import("xlsx");
        const rows = buildRows();
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reporte");
        const blob = new Blob([XLSX.write(wb, { type: "array" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const file = new File([blob], "reporte_gastos.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        await navigator.share({ ...shareData, files: [file] });
        return;
      } catch (err) {
        console.error(err);
      }
    }
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        console.error(err);
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Reporte copiado al portapapeles");
    } catch {
      toast.error("No se pudo compartir el reporte");
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="no-print">
        <h1 className="text-xl font-bold">Reportes</h1>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none mt-2">
          {periods.map((p) => (
            <button key={p.value} onClick={() => setPeriod(p.value)}
              className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
                period === p.value ? "bg-purple-600 text-white" : "bg-zinc-800 text-zinc-400"
              }`}
            >{p.label}</button>
          ))}
        </div>

        {period === "custom" && (
          <div className="flex gap-2">
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
              className="flex-1 bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-3 py-2 text-sm text-zinc-100 outline-none"
            />
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
              className="flex-1 bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-3 py-2 text-sm text-zinc-100 outline-none"
            />
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <Button variant="secondary" size="sm" onClick={handlePrint} className="flex-1">
            <Printer size={14} /> Imprimir
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExportExcel} className="flex-1">
            <FileSpreadsheet size={14} /> Excel
          </Button>
          <Button variant="secondary" size="sm" onClick={handleShare} className="flex-1">
            <Share2 size={14} /> Compartir
          </Button>
        </div>
      </div>

      <div id="report-print" className="space-y-4">
        <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/50 p-3">
          <p className="text-sm font-semibold text-zinc-100">Reporte {periodLabel}</p>
          <p className="text-xs text-zinc-500">{rangeText}</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total", value: formatCurrency(totalAmount), color: "from-purple-600/20 to-purple-900/20" },
            { label: "Registros", value: count.toString(), color: "from-blue-600/20 to-blue-900/20" },
            { label: "Promedio", value: formatCurrency(avg), color: "from-emerald-600/20 to-emerald-900/20" },
          ].map((card) => (
            <div key={card.label} className={`rounded-xl bg-gradient-to-br ${card.color} border border-zinc-800 p-3`}>
              <p className="text-xs text-zinc-500">{card.label}</p>
              <p className="text-sm font-semibold mt-1 truncate">{card.value}</p>
            </div>
          ))}
        </div>

        {topCategory && (
          <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800 p-4">
            <p className="text-xs text-zinc-500 mb-1">Categoría con mayor gasto</p>
            <p className="text-lg font-semibold text-zinc-100">{topCategory.name}</p>
            <p className="text-2xl font-bold text-purple-400">{formatCurrency(topCategory.value)}</p>
          </div>
        )}

        <div className="no-print">
          <div className="flex gap-2">
            {(["bar", "pie", "line"] as const).map((t) => (
              <button key={t} onClick={() => setChartType(t)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors ${
                  chartType === t ? "bg-purple-600 text-white" : "bg-zinc-800 text-zinc-400"
                }`}
              >
                {t === "bar" ? <BarChart3 size={14} /> : t === "pie" ? <PieChart size={14} /> : <TrendingUp size={14} />}
                {t === "bar" ? "Barras" : t === "pie" ? "Circular" : "Líneas"}
              </button>
            ))}
          </div>

          <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800 p-4 mt-2">
            {chartType === "bar" && (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byCategory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: "12px", color: "#f4f4f5" }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {byCategory.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {chartType === "pie" && (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RPieChart>
                    <Pie data={byCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {byCategory.map((entry, i) => (
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

            {chartType === "line" && (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={byDate}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="date" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: "12px", color: "#f4f4f5" }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Line type="monotone" dataKey="amount" stroke="#a855f7" strokeWidth={2} dot={{ fill: "#a855f7" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-zinc-100">
              Detalle de gastos <span className="text-zinc-500">({count})</span>
            </h2>
            <span className="text-xs text-zinc-500 flex items-center gap-1"><Calendar size={12} /> {rangeText}</span>
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-6">No hay gastos en este período</p>
          ) : (
            <div className="space-y-4">
              {filtered.map((ex: Expense) => {
                const details = detailsMap[ex.id] || [];
                const amount = ex.totalAmount || ex.amount;
                return (
                  <div key={ex.id} className="rounded-xl bg-zinc-800/30 border border-zinc-700/50 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700/50">
                      <div>
                        <p className="text-sm font-semibold text-zinc-100">{ex.name}</p>
                        <p className="text-xs text-zinc-500">{ex.code} • {ex.date} • {categoryName(ex.categoryId)}</p>
                      </div>
                      <p className="text-sm font-bold text-purple-400">{formatCurrency(amount)}</p>
                    </div>
                    {details.length > 0 ? (
                      <div className="divide-y divide-zinc-800">
                        {details.map((d) => (
                          <div key={d.id} className="flex items-center justify-between px-3 py-2">
                            <p className="text-xs text-zinc-300">{d.productName}</p>
                            <p className="text-xs text-zinc-500">{d.quantity} x {formatCurrency(d.unitPrice)}</p>
                            <p className="text-xs font-mono text-zinc-100">{formatCurrency(d.subtotal)}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between px-3 py-2">
                        <p className="text-xs text-zinc-500">Gasto sin detalle</p>
                        <p className="text-xs font-mono text-zinc-100">{formatCurrency(amount)}</p>
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-purple-600/10 border border-purple-600/30">
                <p className="text-sm font-semibold text-zinc-100">Total del período</p>
                <p className="text-base font-bold text-purple-400">{formatCurrency(totalAmount)}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
