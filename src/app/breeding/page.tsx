"use client";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Users, Bug, Box, Wheat, Heart, Factory, Pencil, Trash2 } from "lucide-react";
import { useSpecies, useAnimals, useBreedingLots, useFeedings, useReproductions, useLivestockProductions } from "@/features/breeding/hooks/useBreeding";
import { filterAnimals, filterFeedings, ANIMAL_STATUS_LABELS, ANIMAL_GENDER_LABELS, FEED_TYPE_LABELS, REPRO_EVENT_LABELS, PRODUCTION_TYPE_LABELS } from "@/features/breeding/domain/breedingRules";
import { deleteSpecies, deleteBreedingLot, deleteAnimal, deleteFeeding, deleteReproduction, deleteLivestockProduction } from "@/features/breeding/services/breedingService";
import { SpeciesManager } from "@/features/breeding/components/SpeciesManager";
import { BreedingLotManager } from "@/features/breeding/components/BreedingLotManager";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import toast from "react-hot-toast";
import Link from "next/link";

type Section = "especies" | "animales" | "lotes" | "alimentacion" | "reproduccion" | "produccion";

const PAGE_SIZE = 25;

const SECTIONS: { key: Section; label: string; icon: typeof Users }[] = [
  { key: "especies", label: "Especies", icon: Bug },
  { key: "animales", label: "Animales", icon: Users },
  { key: "lotes", label: "Lotes", icon: Box },
  { key: "alimentacion", label: "Alimentación", icon: Wheat },
  { key: "reproduccion", label: "Reproducción", icon: Heart },
  { key: "produccion", label: "Producción", icon: Factory },
];

export default function BreedingPage() {
  const [activeSection, setActiveSection] = useState<Section>("especies");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { species, loading: loadingSpecies } = useSpecies();
  const { animals, loading: loadingAnimals } = useAnimals();
  const { lots, loading: loadingLots } = useBreedingLots();
  const { feedings, loading: loadingFeedings } = useFeedings();
  const { reproductions, loading: loadingReproductions } = useReproductions();
  const { productions, loading: loadingProductions } = useLivestockProductions();
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string; name: string } | null>(null);

  const speciesMap = useMemo(() => Object.fromEntries(species.map((s) => [s.id, s.name])), [species]);
  const lotsMap = useMemo(() => Object.fromEntries(lots.map((l) => [l.id, l.name])), [lots]);
  const animalsMap = useMemo(() => Object.fromEntries(animals.map((a) => [a.id, `${a.code} - ${a.name}`])), [animals]);

  const filteredAnimals = useMemo(() => filterAnimals(animals, { search }), [animals, search]);
  const filteredFeedings = useMemo(() => filterFeedings(feedings, { search }), [feedings, search]);

  const pagedAnimals = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredAnimals.slice(start, start + PAGE_SIZE);
  }, [filteredAnimals, page]);

  const pagedFeedings = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredFeedings.slice(start, start + PAGE_SIZE);
  }, [filteredFeedings, page]);

  const pagedRepros = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return reproductions.slice(start, start + PAGE_SIZE);
  }, [reproductions, page]);

  const pagedProductions = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return productions.slice(start, start + PAGE_SIZE);
  }, [productions, page]);

  const loading = loadingSpecies || loadingAnimals || loadingLots || loadingFeedings || loadingReproductions || loadingProductions;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      switch (deleteTarget.type) {
        case "species": await deleteSpecies(deleteTarget.id); break;
        case "lot": await deleteBreedingLot(deleteTarget.id); break;
        case "animal": await deleteAnimal(deleteTarget.id); break;
        case "feeding": await deleteFeeding(deleteTarget.id); break;
        case "reproduction": await deleteReproduction(deleteTarget.id); break;
        case "production": await deleteLivestockProduction(deleteTarget.id); break;
      }
      toast.success("Eliminado correctamente");
    } catch {
      toast.error("Error al eliminar");
    }
    setDeleteTarget(null);
  };

  const addLinks: Record<Section, string> = {
    especies: "#",
    animales: "/breeding/animals/new",
    lotes: "/breeding/lots/new",
    alimentacion: "/breeding/feedings/new",
    reproduccion: "/breeding/reproductions/new",
    produccion: "/breeding/production/new",
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <h1 className="text-xl font-bold">Crianza</h1>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar animales, alimentación..."
          className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl pl-9 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-purple-500/50"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
                activeSection === s.key ? "bg-purple-600 text-white" : "bg-zinc-800 text-zinc-400"
              }`}
            >
              <Icon size={14} />
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="flex justify-end">
        {activeSection === "especies" || activeSection === "lotes" ? null : (
          <Link href={addLinks[activeSection]}>
            <Button size="sm">
              <Plus size={16} /> Agregar
            </Button>
          </Link>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-zinc-800/50 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {activeSection === "especies" && <SpeciesManager />}

          {activeSection === "lotes" && <BreedingLotManager />}

          {activeSection === "animales" && (
            <div className="space-y-2">
              {pagedAnimals.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-zinc-600">No hay animales registrados</p>
                </div>
                ) : (
                  pagedAnimals.map((animal, i) => (
                  <motion.div
                    key={animal.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-purple-500 bg-purple-600/10 px-2 py-0.5 rounded-md">{animal.code}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            animal.status === "activo" ? "bg-emerald-600/20 text-emerald-400" :
                            animal.status === "vendido" ? "bg-blue-600/20 text-blue-400" :
                            "bg-red-600/20 text-red-400"
                          }`}>{ANIMAL_STATUS_LABELS[animal.status]}</span>
                        </div>
                        <Link href={`/breeding/animals/edit/${animal.id}`} className="block mt-1">
                          <h3 className="font-medium text-zinc-100 truncate">{animal.name}</h3>
                        </Link>
                        <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                          <span>{animal.speciesName || speciesMap[animal.speciesId]}</span>
                          <span>·</span>
                          <span>{ANIMAL_GENDER_LABELS[animal.gender]}</span>
                          <span>·</span>
                          <span>{animal.lotName || lotsMap[animal.lotId]}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Link href={`/breeding/animals/edit/${animal.id}`}>
                          <button className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300">
                            <Pencil size={14} />
                          </button>
                        </Link>
                        <button
                          onClick={() => setDeleteTarget({ type: "animal", id: animal.id, name: animal.name })}
                          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                  ))
              )}
              <Pagination page={page} totalItems={filteredAnimals.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </div>
          )}

          {activeSection === "alimentacion" && (
            <div className="space-y-2">
              {pagedFeedings.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-zinc-600">No hay registros de alimentación</p>
                </div>
                ) : (
                  pagedFeedings.map((f, i) => (
                  <motion.div
                    key={f.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-purple-500 bg-purple-600/10 px-2 py-0.5 rounded-md">{f.code}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-600/20 text-amber-400">
                            {FEED_TYPE_LABELS[f.feedType]}
                          </span>
                        </div>
                        <h3 className="font-medium text-zinc-100 truncate mt-1">{f.feedName}</h3>
                        <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                          <span>{f.lotName || lotsMap[f.lotId]}</span>
                          <span>·</span>
                          <span>{f.quantity} {f.unit}</span>
                          <span>·</span>
                          <span>S/ {f.cost.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setDeleteTarget({ type: "feeding", id: f.id, name: f.feedName })}
                          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                  ))
              )}
              <Pagination page={page} totalItems={filteredFeedings.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </div>
          )}

          {activeSection === "reproduccion" && (
            <div className="space-y-2">
              {pagedRepros.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-zinc-600">No hay registros de reproducción</p>
                </div>
                ) : (
                  pagedRepros.map((r, i) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-purple-500 bg-purple-600/10 px-2 py-0.5 rounded-md">{r.code}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-pink-600/20 text-pink-400">
                            {REPRO_EVENT_LABELS[r.event]}
                          </span>
                        </div>
                        <h3 className="font-medium text-zinc-100 truncate mt-1">
                          {r.animalName || animalsMap[r.animalId]}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                          <span>{r.eventDate}</span>
                          {r.targetAnimal && <><span>·</span><span>{r.targetAnimal}</span></>}
                          {r.result && <><span>·</span><span>{r.result}</span></>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setDeleteTarget({ type: "reproduction", id: r.id, name: r.event })}
                          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                  ))
              )}
              <Pagination page={page} totalItems={reproductions.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </div>
          )}

          {activeSection === "produccion" && (
            <div className="space-y-2">
              {pagedProductions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-zinc-600">No hay registros de producción</p>
                </div>
                ) : (
                  pagedProductions.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-purple-500 bg-purple-600/10 px-2 py-0.5 rounded-md">{p.code}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-600/20 text-cyan-400">
                            {PRODUCTION_TYPE_LABELS[p.type]}
                          </span>
                        </div>
                        <Link href={`/breeding/production/edit/${p.id}`} className="block mt-1">
                          <h3 className="font-medium text-zinc-100 truncate">
                            {p.quantity} {p.unit}
                          </h3>
                        </Link>
                        <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                          <span>{p.lotName || lotsMap[p.lotId]}</span>
                          <span>·</span>
                          <span>{p.productionDate}</span>
                          <span>·</span>
                          <span className="text-emerald-400 font-medium">S/ {p.totalValue.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Link href={`/breeding/production/edit/${p.id}`}>
                          <button className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300">
                            <Pencil size={14} />
                          </button>
                        </Link>
                        <button
                          onClick={() => setDeleteTarget({ type: "production", id: p.id, name: p.type })}
                          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                  ))
              )}
              <Pagination page={page} totalItems={productions.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </div>
          )}
        </>
      )}

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar Registro">
        <p className="text-zinc-400 mb-4">
          ¿Eliminar este registro <strong className="text-zinc-200">{deleteTarget?.name}</strong>?
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button variant="danger" className="flex-1" onClick={handleDelete}>Eliminar</Button>
        </div>
      </Modal>
    </motion.div>
  );
}
