"use client";
import { useSyncStore } from "@/lib/sync";
import { Cloud, CloudOff, RefreshCw, TriangleAlert } from "lucide-react";

// Indicador compacto de sincronización para la barra superior.
// Colores: verde = sincronizado, ámbar = pendiente, azul = sincronizando,
// rojo = sin conexión o errores.

export function SyncIndicator() {
  const { online, status, pendingCount, failedCount, conflictCount } = useSyncStore();

  if (!online) {
    return (
      <span title="Sin conexión — los cambios se guardan localmente">
        <CloudOff size={16} className="text-red-400" />
      </span>
    );
  }

  if (status === "syncing") {
    return (
      <span title="Sincronizando…">
        <RefreshCw size={15} className="text-sky-400 animate-spin" />
      </span>
    );
  }

  if (failedCount > 0 || conflictCount > 0) {
    return (
      <span title={`${failedCount + conflictCount} registro(s) con error de sincronización`}>
        <TriangleAlert size={16} className="text-red-400" />
      </span>
    );
  }

  if (pendingCount > 0) {
    return (
      <span title={`${pendingCount} cambio(s) pendiente(s) de sincronizar`}>
        <Cloud size={16} className="text-amber-400" />
      </span>
    );
  }

  return (
    <span title="Sincronizado">
      <Cloud size={16} className="text-emerald-400" />
    </span>
  );
}
