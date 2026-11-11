"use client";
import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Camera, AlertTriangle } from "lucide-react";
import { PurchaseForm } from "@/features/purchases/components/PurchaseForm";
import { createPurchase } from "@/features/purchases/services/purchaseService";
import { useProducts } from "@/features/sales/hooks/useProducts";
import { getDraft, confirmDraft } from "@/features/invoice/services/invoiceDraftService";
import { matchOcrItemsToProducts, ocrResultToPurchaseHeader } from "@/features/invoice/domain/invoiceRules";
import toast from "react-hot-toast";
import Link from "next/link";
import type { PurchaseFormData } from "@/features/purchases/schemas/purchaseSchema";
import type { PurchaseDetailInput } from "@/features/purchases/domain/purchaseRules";

function NewPurchaseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draft");
  const { products, loading: productsLoading } = useProducts();
  const [loading, setLoading] = useState(false);
  const [header, setHeader] = useState<PurchaseFormData | undefined>();
  const [details, setDetails] = useState<PurchaseDetailInput[] | undefined>();
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [ready, setReady] = useState(!draftId);
  const processedRef = useRef(false);

  useEffect(() => {
    if (!draftId || productsLoading || processedRef.current) return;
    processedRef.current = true;
    let cancelled = false;
    getDraft(draftId)
      .then((draft) => {
        if (cancelled) return;
        if (!draft) {
          toast.error("El comprobante ya no está disponible");
          setReady(true);
          return;
        }
        if (draft.ocrResult) {
          const matched = matchOcrItemsToProducts(draft.ocrResult.items, products);
          setHeader(ocrResultToPurchaseHeader(draft.ocrResult));
          setDetails(matched.details);
          setUnmatched(matched.unmatched);
        }
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [draftId, products, productsLoading]);

  const handleSave = async (data: PurchaseFormData, purchaseDetails: PurchaseDetailInput[], receive: boolean) => {
    setLoading(true);
    try {
      const purchase = await createPurchase({ header: data, details: purchaseDetails }, { receive });
      if (draftId) await confirmDraft(draftId).catch(() => undefined);
      toast.success(receive ? `Compra ${purchase.code} recibida` : "Compra guardada como pendiente");
      router.push("/purchases");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar la compra");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold flex-1">Nueva Compra</h1>
        <Link href="/scan" className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700">
          <Camera size={14} /> Escanear
        </Link>
      </div>

      {unmatched.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-600/10 border border-amber-600/30 px-4 py-3 text-sm text-amber-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            No se encontraron productos para: {unmatched.join(", ")}. Agrégalos a mano en el detalle.
          </span>
        </div>
      )}

      {ready ? (
        <PurchaseForm
          products={products}
          loading={loading}
          onSave={handleSave}
          defaultHeader={header}
          defaultDetails={details}
        />
      ) : (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-zinc-800/50 animate-pulse" />
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default function NewPurchasePage() {
  return (
    <Suspense fallback={<div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-zinc-800/50 animate-pulse" />)}</div>}>
      <NewPurchaseContent />
    </Suspense>
  );
}
