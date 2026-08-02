"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Moon, Sun, Download, Upload, FileSpreadsheet, FileText, RefreshCw, Globe, Database } from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { Button } from "@/components/ui/Button";
import { syncAllToSupabase } from "@/lib/sync-supabase";
import { isSupabaseConfigured } from "@/lib/supabase";
import { db } from "@/lib/db";
import { Modal } from "@/components/ui/Modal";
import { CategoryForm } from "@/features/categories/components/CategoryForm";
import { Input } from "@/components/ui/Input";
import toast from "react-hot-toast";
import { useTranslation } from "@/hooks/useTranslation";
import type { Expense, Category, Type } from "@/types";
import type { CategoryFormData } from "@/features/categories/schemas/categorySchema";

export default function SettingsPage() {
  const { theme, setTheme, language, setLanguage, viewMode, setViewMode, online } = useAppStore();
  const { t: _ } = useTranslation();
  const [syncing, setSyncing] = useState(false);
  const backend = "Supabase";

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncAllToSupabase();
      toast.success("Sincronizado correctamente");
    } catch {
      toast.error("Error al sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  const handleExportCSV = async () => {
    const all = await db.expenses.where({ deleted: false }).toArray();
    if (!all.length) { toast.error("No hay datos para exportar"); return; }
    const headers = "Código,Nombre,Descripción,Monto,Categoría,Tipo,Método Pago,Estado,Fecha,Hora,Notas";
    const rows = all.map((e) =>
      `"${e.code}","${e.name}","${e.description}","${e.amount}","${e.categoryId}","${e.typeId}","${e.paymentMethod}","${e.status}","${e.date}","${e.time}","${e.notes}"`
    ).join("\n");
    const blob = new Blob([`${headers}\n${rows}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `gastos-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  };

  const handleExportJSON = async () => {
    const [expenses, categories, types] = await Promise.all([
      db.expenses.where({ deleted: false }).toArray(),
      db.categories.toArray(),
      db.types.toArray(),
    ]);
    const data = { expenses, categories, types, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `zane-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Respaldo exportado");
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.expenses) await db.expenses.bulkPut(data.expenses);
        if (data.categories) await db.categories.bulkPut(data.categories);
        if (data.types) await db.types.bulkPut(data.types);
        toast.success("Datos importados correctamente");
      } catch {
        toast.error("Error al importar");
      }
    };
    input.click();
  };

  const sections = [
    {
      title: _("settings.appearance"),
      items: [
        {
          icon: theme === "dark" ? Moon : Sun,
          label: _("settings.darkMode"),
          value: theme === "dark" ? _("settings.enabled") : _("settings.disabled"),
          action: () => setTheme(theme === "dark" ? "light" : "dark"),
        },
        {
          icon: Globe,
          label: _("settings.language"),
          value: language === "es" ? "Español" : "English",
          action: () => setLanguage(language === "es" ? "en" : "es"),
        },
      ],
    },
    {
      title: _("settings.data"),
      items: [
        {
          icon: RefreshCw,
          label: _("settings.sync"),
          value: online ? _("settings.online") : _("settings.offline"),
          action: handleSync,
        },
        {
          icon: FileSpreadsheet,
          label: _("settings.exportCSV"),
          value: "",
          action: handleExportCSV,
        },
        {
          icon: Download,
          label: _("settings.exportBackup"),
          value: "",
          action: handleExportJSON,
        },
        {
          icon: Upload,
          label: _("settings.importData"),
          value: "",
          action: handleImport,
        },
      ],
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <h1 className="text-xl font-bold">{_("settings.title")}</h1>

      <div className="flex items-center gap-3 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/60">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xl font-bold text-white">
          U
        </div>
        <div>
          <p className="font-medium">{_("settings.user")}</p>
          <p className="text-xs text-zinc-500">usuario@email.com</p>
        </div>
        <div className="flex flex-col items-end gap-1 ml-auto">
          <div className={`px-3 py-1 rounded-full text-xs ${
            online ? "bg-emerald-600/20 text-emerald-400" : "bg-red-600/20 text-red-400"
          }`}>
            {online ? _("settings.online") : _("settings.offline")}
          </div>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-600/10 text-purple-400 text-[10px]">
            <Database size={10} /> {backend}
          </div>
        </div>
      </div>

      {sections.map((section) => (
        <div key={section.title}>
          <h2 className="text-sm font-medium text-zinc-500 mb-2 px-1">{section.title}</h2>
          <div className="space-y-1">
            {section.items.map((item) => (
              <button key={item.label} onClick={item.action}
                className="w-full flex items-center gap-3 rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-4 hover:bg-zinc-800/60 transition-colors"
              >
                <item.icon size={18} className="text-zinc-400" />
                <span className="flex-1 text-left text-sm text-zinc-200">{item.label}</span>
                {item.value && <span className="text-xs text-zinc-500">{item.value}</span>}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="text-center text-xs text-zinc-700 pt-4">
        {_("settings.version")}
      </div>
    </motion.div>
  );
}
