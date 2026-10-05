import { useState, useEffect } from "react";
import { liveQuery } from "dexie";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { listCustomIcons } from "../services/customIconService";
import type { CustomIcon } from "@/types";

// Set de iconos propios del workspace activo, en vivo: tras importar o borrar
// un icono el selector se actualiza sin recargar la página.

export function useCustomIcons() {
  const [icons, setIcons] = useState<CustomIcon[]>([]);
  const [loading, setLoading] = useState(true);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    const observable = liveQuery(() => listCustomIcons(activeWorkspaceId));

    const sub = observable.subscribe({
      next: (data) => {
        setIcons(data);
        setLoading(false);
      },
      error: (error) => {
        console.error("Dexie: read custom icons", error);
        setLoading(false);
      },
    });

    return () => sub.unsubscribe();
  }, [activeWorkspaceId]);

  return { icons, loading };
}