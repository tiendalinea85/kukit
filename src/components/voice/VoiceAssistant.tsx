"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Loader2, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import { useAppStore } from "@/stores/useAppStore";
import { useTranslation } from "@/hooks/useTranslation";
import { useVoiceRecognition } from "@/lib/voice/useVoiceRecognition";
import { useSpeechSynthesis } from "@/lib/voice/useSpeechSynthesis";
import { parseVoiceTranscript } from "@/lib/voice/parseVoice";
import {
  dispatchVoiceIntent,
  type VoiceActionResult,
} from "@/lib/voice/dispatcher";
import { db } from "@/lib/db";
import { formatCurrency } from "@/utils/format";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ExpenseForm } from "@/features/expenses/components/ExpenseForm";
import { createExpense } from "@/features/expenses/services/expenseService";
import type { ExpenseFormData } from "@/features/expenses/schemas/expenseSchema";
import type { Category, Type } from "@/types";

type Phase = "idle" | "listening" | "processing";

function isConfirmPhrase(text: string): boolean {
  const words = text
    .toLowerCase()
    .replace(/[^a-záéíóúñü]/gi, " ")
    .trim()
    .split(/\s+/);
  if (words.includes("no")) return false;
  return words.some((w) =>
    [
      "confirmar",
      "confirmo",
      "sí",
      "si",
      "yes",
      "yep",
      "ok",
      "okay",
      "guardar",
      "borrar",
      "eliminar",
      "adelante",
      "dale",
      "claro",
      "correcto",
      "seguro",
    ].includes(w)
  );
}

function isCancelPhrase(text: string): boolean {
  const words = text
    .toLowerCase()
    .replace(/[^a-záéíóúñü]/gi, " ")
    .trim()
    .split(/\s+/);
  if (words.includes("no")) return true;
  return words.some((w) =>
    ["cancelar", "cancel", "quitar", "deshacer", "volver", "atras", "atrás"].includes(w)
  );
}

export function VoiceAssistant() {
  const router = useRouter();
  const language = useAppStore((s) => s.language);
  const online = useAppStore((s) => s.online);
  const { t: _ } = useTranslation();

  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [action, setAction] = useState<VoiceActionResult | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [types, setTypes] = useState<Type[]>([]);
  const [saving, setSaving] = useState(false);

  const confirmModeRef = useRef(false);
  const actionRef = useRef<VoiceActionResult | null>(null);
  actionRef.current = action;

  const speakLang = language === "es" ? "es-ES" : "en-US";
  const { speak, cancel } = useSpeechSynthesis();

  const handleRecognitionResult = (text: string, isFinal: boolean) => {
    if (!isFinal) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    if (confirmModeRef.current) {
      if (isConfirmPhrase(trimmed)) {
        stop();
        confirmModeRef.current = false;
        void confirmCurrentAction();
      } else if (isCancelPhrase(trimmed)) {
        stop();
        confirmModeRef.current = false;
        handleModalClose();
      } else {
        speak(_("voice.voiceConfirmHint"), speakLang);
      }
      return;
    }

    void processCommand(trimmed);
  };

  const {
    isListening,
    transcript,
    supported,
    start,
    stop,
    reset,
  } = useVoiceRecognition({
    lang: speakLang,
    onResult: handleRecognitionResult,
  });

  useEffect(() => {
    setMounted(true);
    db.categories.toArray().then(setCategories);
    db.types.toArray().then(setTypes);
    return () => cancel();
  }, [cancel]);

  const handleModalClose = useCallback(() => {
    confirmModeRef.current = false;
    stop();
    setAction(null);
    setPhase("idle");
  }, [stop]);

  const resetAssistant = useCallback(() => {
    confirmModeRef.current = false;
    setAction(null);
    setSaving(false);
    setPhase("idle");
    stop();
    reset();
  }, [stop, reset]);

  const handleActionResult = (result: VoiceActionResult) => {
    switch (result.type) {
      case "navigate":
        resetAssistant();
        break;

      case "unclear": {
        const isOffline = result.reason === "offline";
        const msg = isOffline ? _("voice.offline") : _("voice.unclear");
        toast.error(msg);
        speak(msg, speakLang);
        setPhase("idle");
        break;
      }

      case "show_confirmation": {
        setAction(result);
        setPhase("idle");
        confirmModeRef.current = true;
        const amount = formatCurrency(result.intent.amount);
        const cat =
          result.intent.category || _("expenses.withoutCategory");
        const msg = _("voice.confirmAdd")
          .replace("{amount}", amount)
          .replace("{category}", cat);
        speak(msg, speakLang);
        restartListening();
        break;
      }

      case "confirm_delete": {
        if (result.candidates.length === 0) {
          const msg = _("voice.noMatches");
          toast.error(msg);
          speak(msg, speakLang);
          setPhase("idle");
          break;
        }
        setAction(result);
        setPhase("idle");
        confirmModeRef.current = true;
        const msg =
          result.candidates.length === 1
            ? _("voice.confirmDelete").replace(
                "{name}",
                result.candidates[0].name
              )
            : _("voice.confirmDeleteMany").replace(
                "{count}",
                String(result.candidates.length)
              );
        speak(msg, speakLang);
        restartListening();
        break;
      }

      case "show_report": {
        setAction(result);
        setPhase("idle");
        speak(result.summaryText, speakLang);
        break;
      }
    }
  };

  const processCommand = async (transcript: string) => {
    setPhase("processing");
    cancel();
    const categoryNames = categories.map((c) => c.name);
    const typeNames = types.map((t) => t.name);
    const intent = await parseVoiceTranscript(
      transcript,
      language,
      categoryNames,
      online,
      typeNames
    );
    const result = await dispatchVoiceIntent(intent, { language, router });
    handleActionResult(result);
  };

  const restartListening = useCallback(() => {
    window.setTimeout(() => {
      if (!confirmModeRef.current) return;
      start();
    }, 350);
  }, [start]);

  const confirmCurrentAction = async () => {
    const current = actionRef.current;
    if (!current) {
      resetAssistant();
      return;
    }

    if (current.type === "show_confirmation") {
      setSaving(true);
      try {
        await createExpense(current.expenseData);
        const msg = _("voice.saved");
        toast.success(msg);
        speak(msg, speakLang);
        resetAssistant();
      } catch {
        toast.error("Error al guardar");
        setSaving(false);
      }
      return;
    }

    if (current.type === "confirm_delete") {
      const targets = current.candidates;
      if (targets.length === 0) {
        resetAssistant();
        return;
      }
      for (const target of targets) {
        await db.expenses.update(target.id, {
          deleted: true,
          syncStatus: "pending",
        });
      }
      const msg = _("voice.deleted");
      toast.success(msg);
      speak(msg, speakLang);
      resetAssistant();
    }
  };

  const handleFormSave = async (data: ExpenseFormData) => {
    setSaving(true);
    try {
      await createExpense(data);
      const msg = _("voice.saved");
      toast.success(msg);
      speak(msg, speakLang);
      resetAssistant();
    } catch {
      toast.error("Error al guardar");
      setSaving(false);
    }
  };

  const toggleListening = () => {
    if (!supported) {
      toast.error(_("voice.unsupported"));
      return;
    }
    if (isListening) {
      stop();
      setPhase("idle");
      return;
    }
    confirmModeRef.current = false;
    setPhase("listening");
    reset();
    start();
  };

  if (!mounted) return null;

  return (
    <>
      <AnimatePresence>
        {action === null && supported && (
          <motion.button
            key="voice-button"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={toggleListening}
            aria-label={_("voice.title")}
            className={`fixed bottom-24 right-4 z-40 flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-colors ${
              phase === "processing"
                ? "bg-amber-500 text-white"
                : phase === "listening"
                  ? "bg-red-500 text-white"
                  : "bg-gradient-to-br from-purple-500 to-pink-500 text-white"
            }`}
          >
            {phase === "listening" && (
              <motion.span
                className="absolute inset-0 rounded-full bg-red-500/40"
                animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
              />
            )}
            <span className="relative">
              {phase === "processing" ? (
                <Loader2 size={22} className="animate-spin" />
              ) : (
                <Mic size={22} />
              )}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {action === null && phase === "listening" && (
          <motion.div
            key="voice-transcript"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed bottom-40 right-4 z-40 max-w-[70vw] rounded-2xl bg-zinc-900/95 border border-zinc-800 px-4 py-3 shadow-2xl"
          >
            <p className="text-[11px] text-zinc-500 mb-1">
              {_("voice.listening")}
            </p>
            <p className="text-sm text-zinc-100">
              {transcript || _("voice.hint")}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {action?.type === "show_confirmation" && (
          <Modal open onClose={handleModalClose} title={_("voice.addTitle")}>
            <ExpenseForm
              defaultValues={action.expenseData}
              defaultDetails={action.expenseData.details || []}
              onSubmit={handleFormSave}
              loading={saving}
            />
            <p className="text-xs text-zinc-500 mt-4 text-center">
              {_("voice.voiceConfirmHint")}
            </p>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {action?.type === "show_report" && (
          <Modal open onClose={handleModalClose} title={_("voice.reportTitle")}>
            <p className="text-xs text-zinc-500 mb-3">{action.report.rangeText}</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="rounded-xl bg-purple-600/10 border border-purple-600/20 p-2 text-center">
                <p className="text-[10px] text-zinc-500">{_("reports.total")}</p>
                <p className="text-sm font-semibold text-purple-400 truncate">
                  {formatCurrency(action.report.totalAmount)}
                </p>
              </div>
              <div className="rounded-xl bg-blue-600/10 border border-blue-600/20 p-2 text-center">
                <p className="text-[10px] text-zinc-500">{_("reports.records")}</p>
                <p className="text-sm font-semibold text-blue-400">
                  {action.report.count}
                </p>
              </div>
              <div className="rounded-xl bg-emerald-600/10 border border-emerald-600/20 p-2 text-center">
                <p className="text-[10px] text-zinc-500">{_("reports.average")}</p>
                <p className="text-sm font-semibold text-emerald-400 truncate">
                  {formatCurrency(action.report.average)}
                </p>
              </div>
            </div>
            {action.report.byCategory.length > 0 && (
              <div className="h-40 mb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={action.report.byCategory}>
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#a1a1aa", fontSize: 10 }}
                    />
                    <YAxis tick={{ fill: "#a1a1aa", fontSize: 10 }} />
                    <Bar dataKey="value" fill="#a855f7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {action.report.count === 0 && (
              <p className="text-sm text-zinc-500 text-center py-6">
                {_("voice.reportEmpty")}
              </p>
            )}
            <Button className="w-full" onClick={handleModalClose}>
              {_("voice.done")}
            </Button>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {action?.type === "confirm_delete" && (
          <Modal open onClose={handleModalClose} title={_("voice.deleteTitle")}>
            <div className="space-y-2">
              {action.candidates.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-xl bg-zinc-800/40 border border-zinc-700/50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-100 truncate">
                      {c.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {c.code} • {c.date}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-purple-400 ml-2">
                    {formatCurrency(c.totalAmount || c.amount)}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-4">
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => void confirmCurrentAction()}
              >
                <Trash2 size={14} /> {_("voice.deleteExpense")}
              </Button>
              <Button
                variant="ghost"
                className="flex-1"
                onClick={handleModalClose}
              >
                {_("voice.cancelAction")}
              </Button>
            </div>
            <p className="text-xs text-zinc-500 mt-3 text-center">
              {_("voice.voiceConfirmHint")}
            </p>
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}
