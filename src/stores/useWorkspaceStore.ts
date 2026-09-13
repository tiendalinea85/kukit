import { create } from "zustand";
import { persist } from "zustand/middleware";

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

  addCategory: (c: WorkspaceCategoryItem) => void;
  removeCategory: (id: string) => void;

  addWorkspace: (w: Workspace) => void;
  removeWorkspace: (id: string) => void;
  setActiveWorkspace: (id: string) => void;
  updateWorkspace: (id: string, changes: Partial<Pick<Workspace, "name" | "model" | "modules">>) => void;

  enableModule: (workspaceId: string, moduleKey: string) => void;
  disableModule: (workspaceId: string, moduleKey: string) => void;

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
    { name: "zane-workspaces" },
  ),
);
