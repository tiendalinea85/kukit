"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Scan, Menu, Plus, Building2, ChevronDown, LayoutGrid } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/stores/useAppStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { SyncIndicator } from "@/components/sync/SyncIndicator";

export function TopBar() {
  const router = useRouter();
  const { toggleSidebar, online, openWorkspaceSetup } = useAppStore();
  const [query, setQuery] = useState("");
  const [wsOpen, setWsOpen] = useState(false);
  const wsRef = useRef<HTMLDivElement>(null);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const getWorkspaceCategory = useWorkspaceStore((s) => s.getWorkspaceCategory);
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const [focused, setFocused] = useState(false);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) router.push(`/expenses?q=${encodeURIComponent(query.trim())}`);
  }, [query, router]);

  useEffect(() => {
    if (!wsOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (wsRef.current && !wsRef.current.contains(e.target as Node)) setWsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWsOpen(false);
      if (e.key === "Escape") setFocused(false);
    };
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [wsOpen]);

  return (
    <header className="fixed top-0 left-0 right-0 z-30 bg-zinc-900/90 backdrop-blur-xl border-b border-zinc-800/50 safe-area-top">
      <div className="max-w-lg mx-auto px-4 py-3 lg:max-w-full lg:mx-0 lg:ml-64 lg:mr-0 lg:px-6">
        <div className="flex items-center gap-3">
          <button onClick={toggleSidebar} className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400 lg:hidden">
            <Menu size={22} />
          </button>

          <motion.form
            onSubmit={handleSearch}
            animate={{ flex: focused ? 1 : 1 }}
            className={`relative flex-1 transition-all duration-300 ${focused ? "scale-105" : ""}`}
          >
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Buscar por código, nombre, categoría..."
              className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-all focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30"
            />
            <AnimatePresence>
              {query && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-purple-600 rounded-lg text-xs text-white"
                >
                  Ir
                </motion.button>
              )}
            </AnimatePresence>
          </motion.form>

          <button className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400">
            <Scan size={20} />
          </button>

          <button
            onClick={() => router.push("/expenses/new")}
            className="hidden sm:flex p-1.5 rounded-xl bg-purple-600/20 text-purple-400 hover:bg-purple-600/30"
          >
            <Plus size={20} />
          </button>

          <button className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400" title="Estado de sincronización">
            <SyncIndicator />
          </button>

          <div className="relative flex items-center gap-2 min-w-0" ref={wsRef}>
            <button
              onClick={() => setWsOpen((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-zinc-400 truncate max-w-[110px] sm:max-w-[180px] hover:text-zinc-200 transition-colors"
              title={activeWorkspace?.name ?? "Sin workspace"}
            >
              <Building2 size={14} className="text-purple-400 shrink-0" />
              <span className="truncate">{activeWorkspace?.name ?? "Sin workspace"}</span>
              <ChevronDown size={12} className={`shrink-0 transition-transform ${wsOpen ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {wsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setWsOpen(false)} />
                  <motion.ul
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-zinc-700/60 bg-zinc-900/95 backdrop-blur-xl shadow-2xl shadow-black/50 py-1.5 z-50 max-h-72 overflow-y-auto"
                  >
                    {workspaces.filter((w) => w.id !== "default").map((w) => {
                      const cat = getWorkspaceCategory(w.id);
                      return (
                        <li key={w.id}>
                          <button
                            onClick={() => { setActiveWorkspace(w.id); setWsOpen(false); }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
                              w.id === activeWorkspaceId
                                ? "bg-purple-600/15 text-purple-300"
                                : "text-zinc-300 hover:bg-zinc-800/70"
                            }`}
                          >
                            <span className="text-base shrink-0">{cat?.icon ?? "🏠"}</span>
                            <span className="truncate flex-1">{w.name}</span>
                            {w.id === activeWorkspaceId && <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />}
                          </button>
                        </li>
                      );
                    })}
                    <li className="border-t border-zinc-800 mt-1 pt-1">
                      <button
                        onClick={() => { setWsOpen(false); openWorkspaceSetup(); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-purple-400 hover:bg-purple-600/10 transition-colors"
                      >
                        <Plus size={15} className="shrink-0" />
                        Nuevo espacio de trabajo
                        <LayoutGrid size={13} className="ml-auto shrink-0 opacity-60" />
                      </button>
                    </li>
                  </motion.ul>
                </>
              )}
            </AnimatePresence>

            <div className={`w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold text-white cursor-pointer shrink-0`}>
              {(activeWorkspace?.name ?? " ").charAt(0).toUpperCase()}
            </div>
            {!online && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-zinc-900" />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
