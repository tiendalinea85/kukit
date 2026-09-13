import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ThemeMode, Language, ViewMode } from "@/types";

interface AppState {
  theme: ThemeMode;
  language: Language;
  viewMode: ViewMode;
  sidebarOpen: boolean;
  online: boolean;
  workspaceSetupOpen: boolean;
  setTheme: (t: ThemeMode) => void;
  setLanguage: (l: Language) => void;
  setViewMode: (v: ViewMode) => void;
  toggleSidebar: () => void;
  setOnline: (o: boolean) => void;
  openWorkspaceSetup: () => void;
  closeWorkspaceSetup: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: "dark",
      language: "es",
      viewMode: "card",
      sidebarOpen: false,
      online: true,
      workspaceSetupOpen: false,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setViewMode: (viewMode) => set({ viewMode }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setOnline: (online) => set({ online }),
      openWorkspaceSetup: () => set({ workspaceSetupOpen: true }),
      closeWorkspaceSetup: () => set({ workspaceSetupOpen: false }),
    }),
    {
      name: "zane-app",
      partialize: (s) => ({
        theme: s.theme,
        language: s.language,
        viewMode: s.viewMode,
      }),
    }
  )
);
