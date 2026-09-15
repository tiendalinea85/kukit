import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getCurrentUser, getSupabase } from "@/lib/supabase";
import { fetchWorkspacesForUser, insertWorkspace } from "@/lib/workspace-sync";

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

  loadWorkspaces: (userId: string) => Promise<void>;
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

      // Fuente de verdad: Supabase. Reemplaza la lista en memoria con la del
      // usuario y conserva el workspace activo persistido solo si le pertenece.
      loadWorkspaces: async (userId) => {
        const prevActive = get().activeWorkspaceId;
        set({ loadingWorkspaces: true, loadedForUserId: userId });
        try {
          const next = await fetchWorkspacesForUser(userId);
          const activeWorkspaceId = next.some((w) => w.id === prevActive) ? prevActive : null;
          set({ workspaces: next, activeWorkspaceId, loadingWorkspaces: false });
        } catch (err) {
          set({ loadingWorkspaces: false });
          throw err;
        }
      },

      // Crea en Supabase (si hay sesión) y actualiza el store de inmediato.
      createWorkspace: async (input) => {
        const id = crypto.randomUUID();
        const ws: Workspace = {
          id,
          name: input.name,
          model: input.model,
          modules: [...input.modules],
          categoryId: input.categoryId,
          createdAt: new Date().toISOString(),
        };

        const sb = getSupabase();
        const user = await getCurrentUser();
        if (sb && user) {
          await insertWorkspace(ws, user.id);
        }

        set((s) => ({ workspaces: [...s.workspaces, ws] }));
        set({ activeWorkspaceId: id });
        return ws;
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
      // Solo el workspace activo se persiste localmente (preferencia del
      // dispositivo). La lista de workspaces SIEMPRE viene de Supabase.
      name: "zane-workspaces",
      version: 2,
      migrate: () => ({ activeWorkspaceId: null }),
      partialize: (s) => ({ activeWorkspaceId: s.activeWorkspaceId }),
    },
  ),
);