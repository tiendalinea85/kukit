"use client";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Wheat, MapPin, Package, CalendarCheck, Wrench, Drumstick, Trash2, Edit2 } from "lucide-react";
import Link from "next/link";
import { useCrops, useFarmLots, useAgroInputs, useApplications, useLabors, useHarvests } from "@/features/agriculture/hooks/useAgriculture";
import { filterCrops, filterHarvests, filterLabors } from "@/features/agriculture/domain/agricultureRules";
import { formatDate, formatCurrency } from "@/utils/format";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import toast from "react-hot-toast";

const PAGE_SIZE = 25;

const SECTIONS = [
  { key: "cultivos", label: "Cultivos", icon: Wheat, color: "text-emerald-400" },
  { key: "lotes", label: "Lotes", icon: MapPin, color: "text-blue-400" },
  { key: "insumos", label: "Insumos", icon: Package, color: "text-amber-400" },
  { key: "aplicaciones", label: "Aplicaciones", icon: CalendarCheck, color: "text-pink-400" },
  { key: "labores", label: "Labores", icon: Wrench, color: "text-orange-400" },
  { key: "cosechas", label: "Cosechas", icon: Drumstick, color: "text-purple-400" },
] as const;

export default function AgriculturePage() {
  const [activeSection, setActiveSection] = useState<string>("cultivos");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string; name: string } | null>(null);

  const { crops, loading: loadingCrops, remove: removeCrop } = useCrops();
  const { farmLots, loading: loadingLots, remove: removeLot } = useFarmLots();
  const { agroInputs, loading: loadingInputs, remove: removeInput } = useAgroInputs();
  const { applications, loading: loadingApps, remove: removeApp } = useApplications();
  const { labors, loading: loadingLabors, remove: removeLabor } = useLabors();
  const { harvests, loading: loadingHarvests, remove: removeHarvest } = useHarvests();

  const filteredCrops = useMemo(() => filterCrops(crops, { search }), [crops, search]);
  const filteredHarvests = useMemo(() => filterHarvests(harvests, { search }), [harvests, search]);
  const filteredLabors = useMemo(() => filterLabors(labors, { search }), [labors, search]);

  const filteredLots = useMemo(() => {
    const s = search.toLowerCase();
    return farmLots.filter((l) => {
      if (l.deleted) return false;
      if (!s) return true;
      return [l.code, l.name, l.location, l.soilType].join(" ").toLowerCase().includes(s);
    });
  }, [farmLots, search]);

  const filteredInputs = useMemo(() => {
    const s = search.toLowerCase();
    return agroInputs.filter((i) => {
      if (i.deleted) return false;
      if (!s) return true;
      return [i.code, i.name, i.type, i.supplier].join(" ").toLowerCase().includes(s);
    });
  }, [agroInputs, search]);

  const filteredApps = useMemo(() => {
    const s = search.toLowerCase();
    return applications.filter((a) => {
      if (a.deleted) return false;
      if (!s) return true;
      return [a.code, a.cropName, a.lotName, a.inputName].join(" ").toLowerCase().includes(s);
    });
  }, [applications, search]);

  const pagedCrops = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredCrops.slice(start, start + PAGE_SIZE);
  }, [filteredCrops, page]);

  const pagedLots = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredLots.slice(start, start + PAGE_SIZE);
  }, [filteredLots, page]);

  const pagedInputs = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredInputs.slice(start, start + PAGE_SIZE);
  }, [filteredInputs, page]);

  const pagedApps = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredApps.slice(start, start + PAGE_SIZE);
  }, [filteredApps, page]);

  const pagedLabors = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredLabors.slice(start, start + PAGE_SIZE);
  }, [filteredLabors, page]);

  const pagedHarvests = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredHarvests.slice(start, start + PAGE_SIZE);
  }, [filteredHarvests, page]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      switch (deleteTarget.type) {
        case "cultivo": await removeCrop(deleteTarget.id); break;
        case "lote": await removeLot(deleteTarget.id); break;
        case "insumo": await removeInput(deleteTarget.id); break;
        case "aplicacion": await removeApp(deleteTarget.id); break;
        case "labor": await removeLabor(deleteTarget.id); break;
        case "cosecha": await removeHarvest(deleteTarget.id); break;
      }
      toast.success("Eliminado correctamente");
    } catch {
      toast.error("Error al eliminar");
    }
    setDeleteTarget(null);
  };

  const renderSection = () => {
    if (activeSection === "cultivos") {
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Cultivos</h2>
            <Link href="/agriculture/crops/new">
              <Button size="sm"><Plus size={14} /> Nuevo</Button>
            </Link>
          </div>
          {loadingCrops ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-zinc-800/50 animate-pulse" />)}</div>
          ) : filteredCrops.length === 0 ? (
            <p className="text-center text-zinc-600 py-8">No hay cultivos registrados</p>
          ) : (
            pagedCrops.map((crop, i) => (
              <motion.div key={crop.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-4 hover:border-zinc-700/60 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-purple-500 bg-purple-600/10 px-2 py-0.5 rounded-md">{crop.code}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        crop.status === "activa" ? "bg-emerald-600/20 text-emerald-400" :
                        crop.status === "completada" ? "bg-blue-600/20 text-blue-400" :
                        "bg-red-600/20 text-red-400"
                      }`}>{crop.status}</span>
                    </div>
                    <Link href={`/agriculture/crops/edit/${crop.id}`} className="block mt-1.5">
                      <h3 className="font-medium text-zinc-100 truncate">{crop.name}</h3>
                    </Link>
                    <p className="text-xs text-zinc-500 mt-0.5">{crop.season} &middot; {formatDate(crop.startDate)}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link href={`/agriculture/crops/edit/${crop.id}`}>
                      <button className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"><Edit2 size={14} /></button>
                    </Link>
                    <button onClick={() => setDeleteTarget({ type: "cultivo", id: crop.id, name: crop.name })} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400"><Trash2 size={14} /></button>
                  </div>
                </div>
              </motion.div>
              ))
          )}
          <Pagination page={page} totalItems={filteredCrops.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      );
    }

    if (activeSection === "lotes") {
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Lotes</h2>
            <Link href="/agriculture/lots/new">
              <Button size="sm"><Plus size={14} /> Nuevo</Button>
            </Link>
          </div>
          {loadingLots ? (
            <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-zinc-800/50 animate-pulse" />)}</div>
          ) : filteredLots.length === 0 ? (
            <p className="text-center text-zinc-600 py-8">No hay lotes registrados</p>
          ) : (
            pagedLots.map((lot, i) => (
              <motion.div key={lot.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-4 hover:border-zinc-700/60 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-blue-500 bg-blue-600/10 px-2 py-0.5 rounded-md">{lot.code}</span>
                    </div>
                    <h3 className="font-medium text-zinc-100 truncate mt-1.5">{lot.name}</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">{lot.area} {lot.areaUnit} &middot; {lot.location || "Sin ubicación"}</p>
                  </div>
                  <button onClick={() => setDeleteTarget({ type: "lote", id: lot.id, name: lot.name })} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                </div>
              </motion.div>
              ))
          )}
          <Pagination page={page} totalItems={filteredLots.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      );
    }

    if (activeSection === "insumos") {
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Insumos</h2>
            <Link href="/agriculture/inputs/new">
              <Button size="sm"><Plus size={14} /> Nuevo</Button>
            </Link>
          </div>
          {loadingInputs ? (
            <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-zinc-800/50 animate-pulse" />)}</div>
          ) : filteredInputs.length === 0 ? (
            <p className="text-center text-zinc-600 py-8">No hay insumos registrados</p>
          ) : (
            pagedInputs.map((input, i) => (
              <motion.div key={input.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-4 hover:border-zinc-700/60 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-amber-500 bg-amber-600/10 px-2 py-0.5 rounded-md">{input.code}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-700/50 text-zinc-400">{input.type}</span>
                    </div>
                    <h3 className="font-medium text-zinc-100 truncate mt-1.5">{input.name}</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">{formatCurrency(input.costPerUnit)}/{input.unit} &middot; Stock: {input.stock}</p>
                  </div>
                  <button onClick={() => setDeleteTarget({ type: "insumo", id: input.id, name: input.name })} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                </div>
              </motion.div>
              ))
          )}
          <Pagination page={page} totalItems={filteredInputs.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      );
    }

    if (activeSection === "aplicaciones") {
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Aplicaciones</h2>
            <Link href="/agriculture/applications/new">
              <Button size="sm"><Plus size={14} /> Nueva</Button>
            </Link>
          </div>
          {loadingApps ? (
            <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-zinc-800/50 animate-pulse" />)}</div>
          ) : filteredApps.length === 0 ? (
            <p className="text-center text-zinc-600 py-8">No hay aplicaciones registradas</p>
          ) : (
            pagedApps.map((app, i) => (
              <motion.div key={app.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-4 hover:border-zinc-700/60 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-pink-500 bg-pink-600/10 px-2 py-0.5 rounded-md">{app.code}</span>
                    </div>
                    <h3 className="font-medium text-zinc-100 truncate mt-1.5">{app.inputName}</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">{app.quantity} {app.unit} &middot; {app.cropName} &middot; {formatDate(app.applicationDate)}</p>
                  </div>
                  <button onClick={() => setDeleteTarget({ type: "aplicacion", id: app.id, name: app.inputName })} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                </div>
              </motion.div>
              ))
          )}
          <Pagination page={page} totalItems={filteredApps.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      );
    }

    if (activeSection === "labores") {
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Labores</h2>
            <Link href="/agriculture/labors/new">
              <Button size="sm"><Plus size={14} /> Nueva</Button>
            </Link>
          </div>
          {loadingLabors ? (
            <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-zinc-800/50 animate-pulse" />)}</div>
          ) : filteredLabors.length === 0 ? (
            <p className="text-center text-zinc-600 py-8">No hay labores registradas</p>
          ) : (
            pagedLabors.map((labor, i) => (
              <motion.div key={labor.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-4 hover:border-zinc-700/60 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-orange-500 bg-orange-600/10 px-2 py-0.5 rounded-md">{labor.code}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-700/50 text-zinc-400">{labor.type}</span>
                    </div>
                    <h3 className="font-medium text-zinc-100 truncate mt-1.5">{labor.description}</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">{labor.cropName} &middot; {formatCurrency(labor.laborCost)} &middot; {formatDate(labor.laborDate)}</p>
                  </div>
                  <button onClick={() => setDeleteTarget({ type: "labor", id: labor.id, name: labor.description })} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                </div>
              </motion.div>
              ))
          )}
          <Pagination page={page} totalItems={filteredLabors.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      );
    }

    if (activeSection === "cosechas") {
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Cosechas</h2>
            <Link href="/agriculture/harvests/new">
              <Button size="sm"><Plus size={14} /> Nueva</Button>
            </Link>
          </div>
          {loadingHarvests ? (
            <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-zinc-800/50 animate-pulse" />)}</div>
          ) : filteredHarvests.length === 0 ? (
            <p className="text-center text-zinc-600 py-8">No hay cosechas registradas</p>
          ) : (
            pagedHarvests.map((harvest, i) => (
              <motion.div key={harvest.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-4 hover:border-zinc-700/60 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-purple-500 bg-purple-600/10 px-2 py-0.5 rounded-md">{harvest.code}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        harvest.quality === "premium" ? "bg-emerald-600/20 text-emerald-400" :
                        harvest.quality === "estandar" ? "bg-blue-600/20 text-blue-400" :
                        "bg-red-600/20 text-red-400"
                      }`}>{harvest.quality}</span>
                    </div>
                    <Link href={`/agriculture/harvests/edit/${harvest.id}`} className="block mt-1.5">
                      <h3 className="font-medium text-zinc-100 truncate">{harvest.product}</h3>
                    </Link>
                    <p className="text-xs text-zinc-500 mt-0.5">{harvest.quantity} {harvest.unit} &middot; {formatCurrency(harvest.totalValue)} &middot; {formatDate(harvest.harvestDate)}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link href={`/agriculture/harvests/edit/${harvest.id}`}>
                      <button className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"><Edit2 size={14} /></button>
                    </Link>
                    <button onClick={() => setDeleteTarget({ type: "cosecha", id: harvest.id, name: harvest.product })} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400"><Trash2 size={14} /></button>
                  </div>
                </div>
              </motion.div>
              ))
          )}
          <Pagination page={page} totalItems={filteredHarvests.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      );
    }

    return null;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <h1 className="text-xl font-bold">Agricultura</h1>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cultivos, lotes, insumos..."
          className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl pl-9 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-purple-500/50"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button key={s.key} onClick={() => { setActiveSection(s.key); setPage(1); }}
              className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
                activeSection === s.key ? "bg-purple-600 text-white" : "bg-zinc-800 text-zinc-400"
              }`}
            >
              <Icon size={14} className={s.color} />
              {s.label}
            </button>
          );
        })}
      </div>

      {renderSection()}

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar">
        <p className="text-zinc-400 mb-4">¿Eliminar <strong className="text-zinc-200">{deleteTarget?.name}</strong>?</p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button variant="danger" className="flex-1" onClick={handleDelete}>Eliminar</Button>
        </div>
      </Modal>
    </motion.div>
  );
}
