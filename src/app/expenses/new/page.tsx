"use client";
import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Camera } from "lucide-react";
import { ExpenseForm } from "@/features/expenses/components/ExpenseForm";
import { createExpense } from "@/features/expenses/services/expenseService";
import { useExpenseProducts } from "@/features/expenses/hooks/useExpenseProducts";
import { getDraft, confirmDraft } from "@/features/invoice/services/invoiceDraftService";
import { ocrResultToExpenseData } from "@/features/invoice/domain/invoiceRules";
import { generateExpenseCode } from "@/utils/code";
import toast from "react-hot-toast";
import Link from "next/link";
import type { ExpenseFormData } from "@/features/expenses/schemas/expenseSchema";
import type { ExpenseDetailInput } from "@/types";

function NewExpenseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draft");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [defaults, setDefaults] = useState<Partial<ExpenseFormData> | undefined>();
  const [ready, setReady] = useState(!draftId);
  const { products } = useExpenseProducts();

  useEffect(() => {
    generateExpenseCode().then(setCode);
  }, []);

  useEffect(() => {
    if (!draftId) return;
    let cancelled = false;
    getDraft(draftId)
      .then((draft) => {
        if (cancelled) return;
        if (!draft) {
          toast.error("El comprobante ya no está disponible");
          setReady(true);
          return;
        }
        const extracted = draft.ocrResult ? ocrResultToExpenseData(draft.ocrResult) : {};
        setDefaults({ ...extracted, receiptPhoto: draft.photoBase64 });
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [draftId]);

  const handleSubmit = async (data: ExpenseFormData, details: ExpenseDetailInput[]) => {
    setLoading(true);
    try {
      await createExpense(data, code, details);
      if (draftId) await confirmDraft(draftId).catch(() => undefined);
      toast.success("Gasto registrado exitosamente");
      router.push("/expenses");
    } catch {
      toast.error("Error al registrar gasto");
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
        <h1 className="text-xl font-bold flex-1">Nuevo Gasto</h1>
        <Link href="/scan" className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700">
          <Camera size={14} /> Escanear
        </Link>
      </div>
      {ready ? (
        <ExpenseForm
          onSubmit={handleSubmit}
          loading={loading}
          code={code}
          products={products}
          defaultValues={defaults}
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

export default function NewExpensePage() {
  return (
    <Suspense fallback={<div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-zinc-800/50 animate-pulse" />)}</div>}>
      <NewExpenseContent />
    </Suspense>
  );
}
