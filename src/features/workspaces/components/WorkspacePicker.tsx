"use client";
import { motion } from "framer-motion";
import { ArrowLeft, Building2, Check, ChevronRight, LayoutGrid, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useTranslation } from "@/hooks/useTranslation";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

interface Props {
  onEnter: (id: string) => void;
  onCreate: () => void;
  /** Opcional: si no se entrega, el botón "Volver" no se muestra. */
  onBack?: () => void;
}

export function WorkspacePicker({ onEnter, onCreate, onBack }: Props) {
  const { t } = useTranslation();
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const getWorkspaceCategory = useWorkspaceStore((s) => s.getWorkspaceCategory);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  // Solo se muestran los espacios creados por el usuario (nunca el "default").
  const visible = workspaces.filter((w) => w.id !== "default");

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-6"
      >
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={t("workspace.back")}
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors -ml-2 px-2 py-1.5"
          >
            <ArrowLeft size={18} />
            <span>{t("workspace.back")}</span>
          </button>
        )}

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <LayoutGrid size={22} className="text-purple-400" />
            <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Zane
            </span>
          </div>
          <h1 className="text-xl font-semibold text-zinc-100">{t("workspace.pickerTitle")}</h1>
          <p className="text-sm text-zinc-400">{t("workspace.pickerSubtitle")}</p>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-700 px-4 py-6 text-center text-sm text-zinc-400">
            {t("workspace.noWorkspaces")}
          </div>
        ) : (
          <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
            {visible.map((w) => {
              const cat = getWorkspaceCategory(w.id);
              const isActive = w.id === activeWorkspaceId;
              return (
                <li key={w.id}>
                  <button
                    onClick={() => onEnter(w.id)}
                    className={
                      "w-full flex items-center gap-3 rounded-xl border bg-zinc-800/40 hover:bg-zinc-800 px-4 py-3 text-left transition-colors " +
                      (isActive
                        ? "border-purple-600/50 ring-1 ring-purple-600/30"
                        : "border-zinc-800")
                    }
                  >
                    <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-purple-600/15 border border-purple-600/25 text-xl shrink-0">
                      {cat?.icon ?? <Building2 size={20} className="text-purple-400" />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-zinc-100 truncate">{w.name}</span>
                      <span className="block text-xs text-zinc-500">
                        {cat?.name ?? ""} · {w.modules.length} {t("workspace.modules")}
                      </span>
                    </span>
                    {isActive ? (
                      <Check size={18} className="text-purple-400 shrink-0" />
                    ) : (
                      <ChevronRight size={18} className="text-zinc-500 shrink-0" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <Button variant="secondary" size="lg" className="w-full" onClick={onCreate}>
          <Plus size={18} />
          {t("workspace.createNew")}
        </Button>
      </motion.div>
    </div>
  );
}