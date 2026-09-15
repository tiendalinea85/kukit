"use client";
import { motion } from "framer-motion";
import { Moon, Sun, Download, Upload, FileSpreadsheet, RefreshCw, Globe, Database, LogOut } from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { runManualSync, runRetryNow, useSyncStore } from "@/lib/sync";
import { isSupabaseConfigured } from "@/lib/supabase";
import { db } from "@/lib/db";
import toast from "react-hot-toast";
import { useTranslation } from "@/hooks/useTranslation";

export default function SettingsPage() {
  const { theme, setTheme, language, setLanguage, online } = useAppStore();
  const { user, loading, signOut } = useAuth();
  const { t: _ } = useTranslation();
  const sync = useSyncStore();
  const backend = "Supabase";
  const configured = isSupabaseConfigured();

  const displayName = (() => {
    if (!user) return "";
    const meta = user.user_metadata as Record<string, unknown> | undefined;
    const fullName = typeof meta?.full_name === "string" ? meta.full_name : "";
    if (fullName.trim()) return fullName.trim();
    const name = typeof meta?.name === "string" ? meta.name : "";
    if (name.trim()) return name.trim();
    const emailLocal = (user.email ?? "").split("@")[0];
    if (emailLocal.trim()) return emailLocal.trim();
    return _("settings.user");
  })();

  const avatarLetter = displayName ? displayName.charAt(0).toUpperCase() : "?";

  const handleLogout = async () => {
    if (!window.confirm(_("settings.logoutConfirm"))) return;
    try {
      await signOut();
    } catch {
      toast.error("Error al cerrar sesión");
    }
  };

  const handleSync = async () => {
    try {
      await runManualSync();
      const { failedCount, conflictCount, pendingCount } = useSyncStore.getState();
      if (failedCount > 0 || conflictCount > 0) {
        toast.error(`${failedCount + conflictCount} registro(s) con error al sincronizar`);
      } else if (pendingCount > 0) {
        toast.success("Pendientes enviados");
      } else {
        toast.success("Sincronizado correctamente");
      }
    } catch {
      toast.error("Error al sincronizar");
    }
  };

  const handleRetry = async () => {
    try {
      await runRetryNow();
      const { failedCount, conflictCount } = useSyncStore.getState();
      if (failedCount > 0 || conflictCount > 0) {
        toast.error("Algunos registros siguen con error");
      } else {
        toast.success("Errores resueltos");
      }
    } catch {
      toast.error("Error al reintentar");
    }
  };

  const handleExportCSV = async () => {
    const all = await db.expenses.where({ deleted: false }).toArray();
    if (!all.length) { toast.error("No hay datos para exportar"); return; }
    const headers = "Código,Descripción,Monto,Categoría,Método Pago,Estado,Fecha,Hora,Notas";
    const rows = all.map((e) =>
      `"${e.code}","${e.description}","${e.amount}","${e.categoryId}","${e.paymentMethod}","${e.status}","${e.date}","${e.time}","${e.notes}"`
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
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xl font-bold text-white shrink-0">
          {loading ? <span className="animate-pulse">…</span> : avatarLetter}
        </div>
        <div className="min-w-0">
          {loading ? (
            <p className="font-medium">{_("settings.loadingUser")}</p>
          ) : user ? (
            <>
              <p className="font-medium truncate">{displayName}</p>
              {user.email && <p className="text-xs text-zinc-500 truncate">{user.email}</p>}
            </>
          ) : (
            <>
              <p className="font-medium">{_("settings.user")}</p>
              <p className="text-xs text-zinc-500">{_("settings.notAuthenticated")}</p>
            </>
          )}
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

      <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Sincronización</h2>
          {!configured && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500">
              sin backend
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className={`px-2.5 py-1 rounded-full ${
            sync.online ? "bg-emerald-600/15 text-emerald-400" : "bg-red-600/15 text-red-400"
          }`}>
            {sync.online ? "En línea" : "Sin conexión"}
          </span>
          {sync.status === "syncing" && (
            <span className="px-2.5 py-1 rounded-full bg-sky-600/15 text-sky-400">Sincronizando…</span>
          )}
          {sync.pendingCount > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-amber-600/15 text-amber-400">
              {sync.pendingCount} pendiente(s)
            </span>
          )}
          {sync.failedCount > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-red-600/15 text-red-400">
              {sync.failedCount} con error
            </span>
          )}
          {sync.conflictCount > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-orange-600/15 text-orange-400">
              {sync.conflictCount} conflicto(s)
            </span>
          )}
          {sync.failedCount === 0 && sync.conflictCount === 0 && sync.pendingCount === 0 && (
            <span className="px-2.5 py-1 rounded-full bg-emerald-600/15 text-emerald-400">
              Sincronizado
            </span>
          )}
        </div>

        {sync.lastSyncedAt && (
          <p className="text-[11px] text-zinc-500">
            Última sincronización: {new Date(sync.lastSyncedAt).toLocaleString("es-EC")}
          </p>
        )}
        {sync.lastError && (
          <p className="text-[11px] text-red-400/80">{sync.lastError}</p>
        )}

        <div className="flex gap-2">
          <Button
            variant="primary"
            className="flex-1"
            disabled={sync.status === "syncing" || !configured}
            onClick={() => void handleSync()}
          >
            <RefreshCw size={16} className={sync.status === "syncing" ? "animate-spin" : ""} />
            Sincronizar ahora
          </Button>
          {(sync.failedCount > 0 || sync.conflictCount > 0) && (
            <Button variant="secondary" className="flex-1" onClick={() => void handleRetry()}>
              Reintentar
            </Button>
          )}
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

      <div className="pb-6">
        <Button variant="danger" className="w-full" onClick={() => void handleLogout()}>
          <LogOut size={16} /> {_("settings.logout")}
        </Button>
      </div>
    </motion.div>
  );
}
