"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Loader2, Receipt, RotateCcw, ShoppingCart,
} from "lucide-react";
import { ReceiptCamera } from "@/features/invoice/components/ReceiptCamera";
import { useOCR } from "@/features/invoice/hooks/useOCR";
import { createDraft, discardDraft, updateDraftOcr } from "@/features/invoice/services/invoiceDraftService";
import { ocrTotalComputed } from "@/features/invoice/domain/invoiceRules";
import { formatCurrency, formatDate } from "@/utils/format";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";
import type { OcrResult } from "@/features/invoice/schemas/ocrSchema";

const confidenceLabel: Record<OcrResult["confidence"], string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

const confidenceClass: Record<OcrResult["confidence"], string> = {
  high: "bg-emerald-600/20 text-emerald-400",
  medium: "bg-amber-600/20 text-amber-400",
  low: "bg-rose-600/20 text-rose-400",
};

export default function ScanPage() {
  const router = useRouter();
  const { extractFromImage, extracting, error: ocrError } = useOCR();
  const [photo, setPhoto] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [ocr, setOcr] = useState<OcrResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const busy = processing || extracting;

  const handleCapture = async (dataUrl: string) => {
    setPhoto(dataUrl);
    setOcr(null);
    setError("");
    setProcessing(true);
    try {
      const draft = await createDraft(dataUrl);
      setDraftId(draft.id);
      const result = await extractFromImage(dataUrl);
      if (result) {
        setOcr(result);
        await updateDraftOcr(draft.id, result);
        toast.success("Comprobante analizado");
      } else {
        setError("No se pudieron extraer datos. Puedes continuar y completar el formulario a mano.");
      }
    } catch {
      setError("No se pudo guardar la foto del comprobante.");
    } finally {
      setProcessing(false);
    }
  };

  const handleRetake = async () => {
    if (draftId) await discardDraft(draftId).catch(() => undefined);
    setPhoto(null);
    setDraftId(null);
    setOcr(null);
    setError("");
  };

  const goTo = (target: "expense" | "purchase") => {
    if (!draftId) return;
    router.push(
      target === "expense" ? `/expenses/new?draft=${draftId}` : `/purchases/new?draft=${draftId}`,
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold">Escanear comprobante</h1>
          <p className="text-xs text-zinc-500">Toma una foto y extrae los datos automáticamente.</p>
        </div>
      </div>

      {!photo && (
        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-4 space-y-3">
          <ReceiptCamera onCapture={handleCapture} busy={busy} />
          <p className="text-xs text-zinc-500">
            El OCR requiere `GEMINI_API_KEY` en el servidor. Si no está configurado, la foto se guarda y
            puedes completar los datos manualmente.
          </p>
        </div>
      )}

      {photo && (
        <>
          <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-black relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="Comprobante capturado" className="w-full max-h-[45vh] object-contain" />
            <button
              type="button"
              onClick={handleRetake}
              disabled={busy}
              className="absolute top-2 right-2 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-black/70 text-xs text-zinc-200 hover:text-white disabled:opacity-50"
            >
              <RotateCcw size={13} /> Repetir
            </button>
          </div>

          {busy && (
            <div className="flex items-center gap-2 rounded-xl bg-zinc-900/60 border border-zinc-800 px-4 py-3 text-sm text-zinc-300">
              <Loader2 size={16} className="animate-spin text-purple-400" />
              Analizando comprobante…
            </div>
          )}

          {(error || ocrError) && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-600/10 border border-amber-600/30 px-4 py-3 text-sm text-amber-300">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{error || ocrError}</span>
            </div>
          )}

          {ocr && (
            <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400" /> Datos detectados
                </p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${confidenceClass[ocr.confidence]}`}>
                  Confianza {confidenceLabel[ocr.confidence]}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-zinc-500">Proveedor</p>
                  <p className="text-zinc-200 truncate">{ocr.supplier || "No detectado"}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Comprobante</p>
                  <p className="text-zinc-200 truncate">{ocr.invoiceNumber || "Sin número"}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Fecha</p>
                  <p className="text-zinc-200">{ocr.date ? formatDate(ocr.date) : "No detectada"}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Total</p>
                  <p className="text-zinc-200">{formatCurrency(ocrTotalComputed(ocr))}</p>
                </div>
              </div>

              {ocr.items.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-xs text-zinc-500">Productos detectados ({ocr.items.length})</p>
                  {ocr.items.map((item, i) => (
                    <div key={`${item.description}-${i}`} className="flex items-center justify-between text-xs rounded-lg bg-zinc-800/40 px-3 py-2">
                      <span className="text-zinc-300 truncate">{item.description}</span>
                      <span className="text-zinc-400 shrink-0 ml-2">
                        {item.quantity} × {formatCurrency(item.unitPrice)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid gap-2">
            <Button type="button" onClick={() => goTo("expense")} disabled={busy || !draftId} className="w-full">
              <Receipt size={16} /> Registrar como gasto
            </Button>
            <Button type="button" variant="secondary" onClick={() => goTo("purchase")} disabled={busy || !draftId} className="w-full">
              <ShoppingCart size={16} /> Registrar como compra
            </Button>
          </div>
          <p className="text-xs text-zinc-500 text-center">
            Podrás revisar y corregir los datos antes de guardar. El comprobante se adjunta al gasto; en
            compras se usa solo para extraer la información.
          </p>
        </>
      )}
    </motion.div>
  );
}
