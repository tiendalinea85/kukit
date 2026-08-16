"use client";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, Home, PlusCircle, List, Briefcase, Tag, Type, BarChart3, Settings, Trash2, ReceiptText, Users, Package, ShoppingBag, Truck } from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";

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
  { href: "/categories", label: "Categorías", icon: Tag },
  { href: "/types", label: "Tipos", icon: Type },
  { href: "/reports", label: "Reportes", icon: BarChart3 },
  { href: "/settings", label: "Configuración", icon: Settings },
  { href: "/trash", label: "Papelera", icon: Trash2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar } = useAppStore();

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
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {links.map((link) => {
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
            <div className="p-4 border-t border-zinc-800 text-xs text-zinc-600 text-center">
              Zane v1.0.0
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
