"use client";
import { useSyncStore } from "@/lib/sync";
import { RefreshCw } from "lucide-react";

// Indicador del estado de sincronización:
//   - Sin conexión (offline)
//   - Sincronizando (syncing)
//   - Errores (error): con fallidos/conflictos
//   - Pendiente (cambios sin enviar)
//   - Sincronizado (synced)

export function SyncStatusBadge() {
  const { online, status, pendingCount, failedCount, conflictCount, lastError } = useSyncStore();

  if (!online) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-400">
        <span className="w-2 h-2 rounded-full bg-red-500" />
        Sin conexión
      </span>
    );
  }

  if (status === "syncing" || (status === "idle" && pendingCount > 0)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-sky-600/15 text-sky-400 border border-sky-600/20">
        <RefreshCw size={12} className="animate-spin" />
        Sincronizando
      </span>
    );
  }

  if (status === "error" || failedCount > 0 || conflictCount > 0) {
    const total = failedCount + conflictCount;
    return (
      <span
        title={lastError ?? undefined}
        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-red-600/15 text-red-400 border border-red-600/20"
      >
        <span className="w-2 h-2 rounded-full bg-red-400" />
        {total} con error
      </span>
    );
  }

  if (pendingCount > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-amber-600/15 text-amber-400 border border-amber-600/20">
        <span className="w-2 h-2 rounded-full bg-amber-400" />
        {pendingCount} pendientes
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-emerald-600/15 text-emerald-400 border border-emerald-600/20">
      <span className="w-2 h-2 rounded-full bg-emerald-400" />
      Sincronizado
    </span>
  );
}
