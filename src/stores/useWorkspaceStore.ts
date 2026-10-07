import { newId } from "@/utils/id";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getCurrentUser, getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { fetchWorkspacesForUser, insertWorkspace } from "@/lib/workspace-sync";
import { isOffline, withTimeout } from "@/lib/net";

export type BusinessModel =
  | "tailoring"
  | "agriculture"
  | "automotive_parts"
  | "breeding"
  | "commerce"
  | "services"
  | "personal"
  | "general";

export type WorkspaceCategory = "personal" | "trabajo" | "estudio" | "negocio";

export interface Workspace {
  id: string;
  name: string;
  model: BusinessModel;
  modules: string[];
  categoryId: string;
  createdAt: string;
  /**
   * Creado solo en local: el INSERT en Supabase falló o no había sesión
   * (offline, login mock). No propagarlo a otros dispositivos ni perderlo al
   * recargar: loadWorkspaces reintenta el push y limpia la marca.
   */
  pendingSync?: boolean;
}

export type CreateWorkspaceInput = Pick<Workspace, "name" | "model" | "modules" | "categoryId">;

export interface WorkspaceCategoryItem {
  id: string;
  name: string;
  icon: string;
  createdAt: string;
}

export const WORKSPACE_CATEGORIES: WorkspaceCategoryItem[] = [
  { id: "personal", name: "Personal", icon: "🏠", createdAt: "2025-01-01T00:00:00Z" },
  { id: "trabajo", name: "Trabajo", icon: "💼", createdAt: "2025-01-01T00:00:00Z" },
  { id: "estudio", name: "Estudio", icon: "📚", createdAt: "2025-01-01T00:00:00Z" },
  { id: "negocio", name: "Negocio", icon: "🏢", createdAt: "2025-01-01T00:00:00Z" },
];

export const ALL_MODULES = [
  "expenses", "reports", "sales", "purchases", "inventory",
  "investments", "customers", "categories",
  "tailoring", "agriculture", "autoparts", "breeding",
] as const;

export type ModuleKey = (typeof ALL_MODULES)[number];

export const MODEL_MODULES: Record<BusinessModel, string[]> = {
  personal: ["expenses", "reports"],
  general: ["expenses", "reports"],
  commerce: ["expenses", "reports", "sales", "purchases", "inventory", "investments", "customers", "categories"],
  services: ["expenses", "reports", "investments", "categories"],
  tailoring: ["expenses", "reports", "sales", "purchases", "inventory", "customers", "categories", "tailoring"],
  agriculture: ["expenses", "reports", "agriculture"],
  automotive_parts: ["expenses", "reports", "sales", "purchases", "inventory", "customers", "categories", "autoparts"],
  breeding: ["expenses", "reports", "breeding"],
};

interface WorkspaceState {
  categories: WorkspaceCategoryItem[];
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  loadingWorkspaces: boolean;
  loadedForUserId: string | null;

  addCategory: (c: WorkspaceCategoryItem) => void;
  removeCategory: (id: string) => void;

  addWorkspace: (w: Workspace) => void;
  removeWorkspace: (id: string) => void;
  setActiveWorkspace: (id: string) => void;
  updateWorkspace: (id: string, changes: Partial<Pick<Workspace, "name" | "model" | "modules">>) => void;

  enableModule: (workspaceId: string, moduleKey: string) => void;
  disableModule: (workspaceId: string, moduleKey: string) => void;

  loadWorkspaces: (userId?: string | null) => Promise<void>;
  createWorkspace: (input: CreateWorkspaceInput) => Promise<Workspace>;
  resetWorkspaces: () => void;

  getActiveWorkspace: () => Workspace | undefined;
  getWorkspaceCategory: (workspaceId: string) => WorkspaceCategoryItem | undefined;
  getWorkspacesByCategory: (categoryId: string) => Workspace[];
  isModuleEnabled: (moduleKey: string) => boolean;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      categories: [...WORKSPACE_CATEGORIES],
      workspaces: [],
      activeWorkspaceId: null,
      loadingWorkspaces: false,
      loadedForUserId: null,

      addCategory: (c) =>
        set((s) => ({ categories: [...s.categories, c] })),

      removeCategory: (id) =>
        set((s) => ({ categories: s.categories.filter((c) => c.id !== id) })),

      addWorkspace: (w) =>
        set((s) => ({ workspaces: [...s.workspaces, w] })),

      removeWorkspace: (id) =>
        set((s) => ({
          workspaces: s.workspaces.filter((w) => w.id !== id),
          activeWorkspaceId:
            s.activeWorkspaceId === id
              ? s.workspaces.find((w) => w.id !== id)?.id ?? null
              : s.activeWorkspaceId,
        })),

      setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

      updateWorkspace: (id, changes) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) =>
            w.id === id ? { ...w, ...changes } : w,
          ),
        })),

      enableModule: (workspaceId, moduleKey) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) =>
            w.id === workspaceId && !w.modules.includes(moduleKey)
              ? { ...w, modules: [...w.modules, moduleKey] }
              : w,
          ),
        })),

      disableModule: (workspaceId, moduleKey) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) =>
            w.id === workspaceId
              ? { ...w, modules: w.modules.filter((m) => m !== moduleKey) }
              : w,
          ),
        })),

      // Fuente de verdad: Supabase. La lista en memoria se compone con la del
      // usuario (los pendientes se suben, no se descartan) y conserva el
      // workspace activo persistido solo si le pertenece.
      // Offline-First: con cache local del mismo usuario, entra de inmediato
      // sin red (clave: la app instalada en iOS no debe quedar en spinner).
      loadWorkspaces: async (userId) => {
        const prevActive = get().activeWorkspaceId;
        const cache = get().workspaces;
        const cachedFor = get().loadedForUserId;

        if (isOffline() && cachedFor === userId && cache.length > 0) {
          const active = cache.some((w) => w.id === prevActive) ? prevActive : cache[0].id;
          set({ loadingWorkspaces: false, activeWorkspaceId: active });
          return;
        }

        // Sin userId no hay consulta posible (sesión no resuelta, login mock o
        // Supabase sin configurar). Conservar la lista local: reemplazarla por
        // un [] hacía desaparecer los workspaces del usuario en cada recarga.
        if (!userId || !isSupabaseConfigured()) {
          set({ loadingWorkspaces: false });
          return;
        }

        set({ loadingWorkspaces: true, loadedForUserId: userId });
        try {
          const next = await withTimeout(fetchWorkspacesForUser(userId));

          // Los workspaces creados sin sesión quedan solo en local. Se suben
          // ahora que hay red y usuario; los que fallan se conservan en la lista
          // (no se descartan) y se reintentan en la próxima carga.
          const remoteIds = new Set(next.map((w) => w.id));
          const unsynced: Workspace[] = [];
          const confirmed: Workspace[] = [];
          for (const w of cache) {
            if (!w.pendingSync || remoteIds.has(w.id)) continue;
            try {
              await insertWorkspace(w, userId);
              confirmed.push({ ...w, pendingSync: false });
            } catch {
              unsynced.push(w);
            }
          }

          const merged = [...next, ...unsynced, ...confirmed];
          const activeWorkspaceId = merged.some((w) => w.id === prevActive) ? prevActive : null;
          set({ workspaces: merged, activeWorkspaceId, loadingWorkspaces: false });
        } catch (err) {
          // Sin red o con timeout: usar la cache local del mismo usuario en
          // lugar de colgar la UI (spinner a pantalla completa en iOS).
          if (cachedFor === userId && cache.length > 0) {
            const active = cache.some((w) => w.id === prevActive) ? prevActive : cache[0].id;
            set({ loadingWorkspaces: false, activeWorkspaceId: active });
            return;
          }
          set({ loadingWorkspaces: false });
          throw err;
        }
      },

      // Crea en Supabase (si hay sesión) y actualiza el store de inmediato.
      createWorkspace: async (input) => {
        const id = newId();
        const ws: Workspace = {
          id,
          name: input.name,
          model: input.model,
          modules: [...input.modules],
          categoryId: input.categoryId,
          createdAt: new Date().toISOString(),
        };

        // Offline-First: el workspace existe localmente aunque el INSERT
        // remoto no sea posible. Antes se omitía en silencio y el workspace
        // desaparecía al recargar (solo vivía en memoria).
        let pendingSync = true;
        const sb = getSupabase();
        const user = await getCurrentUser();
        if (sb && user) {
          try {
            await insertWorkspace(ws, user.id);
            pendingSync = false;
          } catch {
            // Red caída o RLS: se reintentará en la próxima loadWorkspaces.
          }
        }

        set((s) => ({ workspaces: [...s.workspaces, { ...ws, pendingSync }] }));
        set({ activeWorkspaceId: id });
        return { ...ws, pendingSync };
      },

      resetWorkspaces: () =>
        set({ workspaces: [], activeWorkspaceId: null, loadingWorkspaces: false, loadedForUserId: null }),

      getActiveWorkspace: () => {
        const { workspaces, activeWorkspaceId } = get();
        return workspaces.find((w) => w.id === activeWorkspaceId);
      },

      getWorkspaceCategory: (workspaceId) => {
        const ws = get().workspaces.find((w) => w.id === workspaceId);
        if (!ws) return undefined;
        return get().categories.find((c) => c.id === ws.categoryId);
      },

      getWorkspacesByCategory: (categoryId) => {
        return get().workspaces.filter((w) => w.categoryId === categoryId);
      },

      isModuleEnabled: (moduleKey) => {
        const ws = get().getActiveWorkspace();
        return ws?.modules.includes(moduleKey) ?? false;
      },
    }),
    {
      // La lista de workspaces se cachea localmente (última versión conocida)
      // para poder entrar sin red (Offline-First). El workspace activo se
      // persiste como preferencia del dispositivo. Al estar online, loadWorkspaces
      // reemplaza siempre la cache con lo que venga de Supabase.
      name: "zane-workspaces",
      version: 3,
      migrate: () => ({ activeWorkspaceId: null, workspaces: [], loadedForUserId: null }),
      partialize: (s) => ({
        activeWorkspaceId: s.activeWorkspaceId,
        workspaces: s.workspaces,
        loadedForUserId: s.loadedForUserId,
      }),
    },
  ),
);