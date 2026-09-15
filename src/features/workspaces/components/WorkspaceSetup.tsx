"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Building2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useTranslation } from "@/hooks/useTranslation";
import { MODEL_MODULES, WORKSPACE_CATEGORIES, useWorkspaceStore, type BusinessModel } from "@/stores/useWorkspaceStore";
import { seedForWorkspace } from "@/lib/seed";

interface Props {
  onCreated: (id: string) => void;
}

const MODEL_KEYS = Object.keys(MODEL_MODULES) as BusinessModel[];

export function WorkspaceSetup({ onCreated }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [model, setModel] = useState<BusinessModel>("general");
  const [category, setCategory] = useState(WORKSPACE_CATEGORIES[0].id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);

  const canSubmit = name.trim().length > 0 && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(false);
    try {
      const ws = await createWorkspace({
        name: name.trim(),
        model,
        modules: [...MODEL_MODULES[model]],
        categoryId: category,
      });
      await seedForWorkspace(ws.id);
      onCreated(ws.id);
    } catch {
      setError(true);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-6"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Building2 size={22} className="text-purple-400" />
            <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Zane
            </span>
          </div>
          <h1 className="text-xl font-semibold text-zinc-100">{t("workspace.setupTitle")}</h1>
          <p className="text-sm text-zinc-400">{t("workspace.setupSubtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={t("workspace.nameLabel")}
            placeholder={t("workspace.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoFocus
          />

          <Select
            label={t("workspace.modelLabel")}
            value={model}
            onChange={(e) => setModel(e.target.value as BusinessModel)}
            options={MODEL_KEYS.map((m) => ({ value: m, label: t(`workspace.modelNames.${m}`) }))}
          />

          <Select
            label={t("workspace.categoryLabel")}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={WORKSPACE_CATEGORIES.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))}
          />

          <div className="rounded-xl bg-zinc-800/40 border border-zinc-800 px-4 py-3">
            <p className="text-xs text-zinc-400 flex items-center gap-1.5 mb-2">
              <Sparkles size={13} className="text-purple-400" />
              {t("workspace.modelHint")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {MODEL_MODULES[model].map((m) => (
                <span
                  key={m}
                  className="text-[11px] font-medium text-purple-300 bg-purple-600/15 border border-purple-600/25 rounded-full px-2.5 py-0.5"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
              <AlertCircle size={14} className="shrink-0" />
              {t("workspace.createError")}
            </div>
          )}

          <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!canSubmit}>
            {loading ? t("workspace.creating") : t("workspace.create")}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}