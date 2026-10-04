import { useState, useEffect } from "react";
import { liveQuery } from "dexie";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { listCategories } from "../services/categoryService";
import type { Category } from "@/types";

// Listado de categorías del workspace activo, en vivo: se actualiza solo tras
// crear o editar (incluido el alta inline del propio formulario), sin recargar.

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    const observable = liveQuery(() => listCategories(activeWorkspaceId));

    const sub = observable.subscribe({
      next: (data) => {
        setCategories(data);
        setLoading(false);
      },
      error: (error) => {
        console.error("Dexie: read categories", error);
        setLoading(false);
      },
    });

    return () => sub.unsubscribe();
  }, [activeWorkspaceId]);

  return { categories, loading };
}
