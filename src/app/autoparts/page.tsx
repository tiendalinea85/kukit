"use client";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Edit2, Trash2, Wrench, Globe, Car, Link2 } from "lucide-react";
import { useAutoParts } from "@/features/autoparts/hooks/useAutoparts";
import { deleteAutoPart } from "@/features/autoparts/services/autopartsService";
import { filterAutoParts, PART_CATEGORIES } from "@/features/autoparts/domain/autopartsRules";
import { BrandManager } from "@/features/autoparts/components/BrandManager";
import { ModelManager } from "@/features/autoparts/components/ModelManager";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import toast from "react-hot-toast";
import Link from "next/link";

type Section = "parts" | "brands" | "models" | "compatibility";

const PAGE_SIZE = 25;

export default function AutoPartsPage() {
  const { parts } = useAutoParts();
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [activeSection, setActiveSection] = useState<Section>("parts");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const filtered = useMemo(() => {
    return filterAutoParts(parts, { search, category: filterCategory });
  }, [parts, search, filterCategory]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteAutoPart(deleteTarget.id);
    toast.success("Repuesto eliminado");
    setDeleteTarget(null);
  };

  const tabs: { key: Section; label: string; icon: React.ReactNode }[] = [
    { key: "parts", label: "Repuestos", icon: <Wrench size={14} /> },
    { key: "brands", label: "Marcas", icon: <Globe size={14} /> },
    { key: "models", label: "Modelos", icon: <Car size={14} /> },
    { key: "compatibility", label: "Compatibilidad", icon: <Link2 size={14} /> },
  ];

  const stockColor = (stock: number, minStock: number) => {
    if (stock <= 0) return "text-red-400";
    if (stock <= minStock) return "text-amber-400";
    return "text-emerald-400";
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Repuestos Automotrices</h1>
        {activeSection === "parts" && (
          <Link href="/autoparts/parts/new">
            <Button size="sm"><Plus size={16} /> Nuevo</Button>
          </Link>
        )}
        {activeSection === "brands" && (
          <Link href="/autoparts/brands/new">
            <Button size="sm"><Plus size={16} /> Nueva</Button>
          </Link>
        )}
        {activeSection === "models" && (
          <Link href="/autoparts/models/new">
            <Button size="sm"><Plus size={16} /> Nuevo</Button>
          </Link>
        )}
        {activeSection === "compatibility" && (
          <Link href="/autoparts/compatibility/new">
            <Button size="sm"><Plus size={16} /> Nueva</Button>
          </Link>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
              activeSection === tab.key
                ? "bg-purple-600 text-white"
                : "bg-zinc-800 text-zinc-400"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeSection === "parts" && (
        <>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar repuestos..."
              className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl pl-9 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-purple-500/50"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button onClick={() => setFilterCategory("")}
              className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${!filterCategory ? "bg-purple-600 text-white" : "bg-zinc-800 text-zinc-400"}`}
            >Todos</button>
            {PART_CATEGORIES.map((c) => (
              <button key={c.value} onClick={() => setFilterCategory(c.value)}
                className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${filterCategory === c.value ? "bg-purple-600 text-white" : "bg-zinc-800 text-zinc-400"}`}
              >{c.label}</button>
            ))}
          </div>

          <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar Repuesto">
            <p className="text-zinc-400 mb-4">¿Eliminar el repuesto <strong className="text-zinc-200">{deleteTarget?.name}</strong>?</p>
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
              <Button variant="danger" className="flex-1" onClick={handleDelete}>Eliminar</Button>
            </div>
          </Modal>

          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <Wrench size={40} className="mx-auto text-zinc-700 mb-3" />
              <p className="text-zinc-600 text-lg">No hay repuestos registrados</p>
              <p className="text-zinc-700 text-sm mt-1">Crea tu primer repuesto para comenzar.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {paged.map((part, i) => (
                <motion.div
                  key={part.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="group rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-4 hover:border-zinc-700/60 transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-purple-500 bg-purple-600/10 px-2 py-0.5 rounded-md">{part.code}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                          {PART_CATEGORIES.find((c) => c.value === part.category)?.label || part.category}
                        </span>
                      </div>
                      <h3 className="font-medium text-zinc-100 truncate mt-1.5">{part.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                        <span>{part.partNumber}</span>
                        {part.brand && <><span>·</span><span>{part.brand}</span></>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 ml-3">
                      <span className={`text-sm font-semibold ${stockColor(part.stock, part.minStock)}`}>
                        Stock: {part.stock}
                      </span>
                      {part.stock <= part.minStock && part.stock > 0 && (
                        <span className="text-[10px] text-amber-500">Stock bajo</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 mt-2">
                    <div className="flex-1" />
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={`/autoparts/parts/edit/${part.id}`}>
                        <button className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300">
                          <Edit2 size={14} />
                        </button>
                      </Link>
                      <button onClick={() => setDeleteTarget({ id: part.id, name: part.name })} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
          <Pagination page={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </>
      )}

      {activeSection === "brands" && <BrandManager />}
      {activeSection === "models" && <ModelManager />}
      {activeSection === "compatibility" && (
        <div className="text-center py-16">
          <Link2 size={40} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-600 text-lg">Gestiona la compatibilidad</p>
          <p className="text-zinc-700 text-sm mt-1">Asocia repuestos con modelos de vehículos.</p>
          <Link href="/autoparts/compatibility/new">
            <Button size="sm" className="mt-4"><Plus size={14} /> Nueva Compatibilidad</Button>
          </Link>
        </div>
      )}
    </motion.div>
  );
}
