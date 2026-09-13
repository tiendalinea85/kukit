"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, Home, PlusCircle, List, Briefcase, Tag, Type, BarChart3, Settings, Trash2, ReceiptText, Users, Package, ShoppingBag, Truck, Scissors, Wheat, Car, Egg, ChevronDown, Building2 } from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

const ALWAYS_SHOW = new Set(["/", "/reports", "/settings", "/trash"]);

const MODULE_LINKS: Record<string, string[]> = {
  expenses: ["/expenses/new", "/expenses"],
  sales: ["/sales/new", "/sales", "/customers", "/products"],
  purchases: ["/purchases"],
  investments: ["/investments/new", "/investments"],
  categories: ["/categories", "/types"],
  tailoring: ["/tailoring"],
  agriculture: ["/agriculture"],
  autoparts: ["/autoparts"],
  breeding: ["/breeding"],
};

const links = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/sales/new", label: "Registrar Venta", icon: ShoppingBag },
  { href: "/sales", label: "Ventas", icon: ReceiptText },
  { href: "/customers", label: "Clientes", icon: Users },
  { href: "/products", label: "Productos e Inventario", icon: Package },
  { href: "/expenses/new", label: "Registrar Gasto", icon: PlusCircle },
  { href: "/expenses", label: "Lista de Gastos", icon: List },
  { href: "/purchases", label: "Compras", icon: Truck },
  { href: "/investments/new", label: "Registrar Inversión", icon: PlusCircle },
  { href: "/investments", label: "Inversiones", icon: Briefcase },
  { href: "/tailoring", label: "Taller Confección", icon: Scissors },
  { href: "/agriculture", label: "Agricultura", icon: Wheat },
  { href: "/autoparts", label: "Repuestos Auto", icon: Car },
  { href: "/breeding", label: "Crianza", icon: Egg },
  { href: "/categories", label: "Categorías", icon: Tag },
  { href: "/types", label: "Tipos", icon: Type },
  { href: "/reports", label: "Reportes", icon: BarChart3 },
  { href: "/settings", label: "Configuración", icon: Settings },
  { href: "/trash", label: "Papelera", icon: Trash2 },
];

function getModuleForHref(href: string): string | undefined {
  for (const [mod, routes] of Object.entries(MODULE_LINKS)) {
    if (routes.includes(href)) return mod;
  }
  return undefined;
}

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar } = useAppStore();
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const isModuleEnabled = useWorkspaceStore((s) => s.isModuleEnabled);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  const visibleLinks = links.filter((link) => {
    if (ALWAYS_SHOW.has(link.href)) return true;
    const mod = getModuleForHref(link.href);
    if (!mod) return true;
    return isModuleEnabled(mod);
  });

  return (
    <AnimatePresence>
      {sidebarOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={toggleSidebar}
          />
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed left-0 top-0 bottom-0 w-64 bg-zinc-900/95 backdrop-blur-xl border-r border-zinc-800 z-50 flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Zane</span>
              <button onClick={toggleSidebar} className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400">
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 p-3 space-y-1 overflow-y-auto mt-2">
              {visibleLinks.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link key={link.href} href={link.href} onClick={toggleSidebar}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all ${
                      active ? "bg-purple-600/20 text-purple-400" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                    }`}
                  >
                    <link.icon size={18} />
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <div className="relative px-3 pb-2">
              <button
                onClick={() => setWorkspaceOpen((v) => !v)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 transition-colors"
              >
                <Building2 size={16} className="text-purple-400 shrink-0" />
                <span className="truncate flex-1 text-left">{activeWorkspace?.name ?? "Sin workspace"}</span>
                <ChevronDown size={14} className={`shrink-0 transition-transform ${workspaceOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {workspaceOpen && (
                  <motion.ul
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute left-3 right-3 bottom-full mb-1 bg-zinc-800 border border-zinc-700 rounded-xl shadow-lg overflow-hidden z-50 max-h-48 overflow-y-auto"
                  >
                    {workspaces.filter((w) => w.id !== "default").map((w) => (
                      <li key={w.id}>
                        <button
                          onClick={() => { setActiveWorkspace(w.id); setWorkspaceOpen(false); }}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                            w.id === activeWorkspaceId
                              ? "bg-purple-600/20 text-purple-400"
                              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50"
                          }`}
                        >
                          {w.name}
                        </button>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
            <div className="p-4 border-t border-zinc-800 text-xs text-zinc-600 text-center">
              Zane v1.0.0
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
