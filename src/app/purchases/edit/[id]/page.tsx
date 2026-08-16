"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { PurchaseForm } from "@/features/purchases/components/PurchaseForm";
import { updatePurchase } from "@/features/purchases/services/purchaseService";
import { useProducts } from "@/features/sales/hooks/useProducts";
import { db } from "@/lib/db";
import toast from "react-hot-toast";
import type { PurchaseDetail } from "@/types";
import type { PurchaseFormData } from "@/features/purchases/schemas/purchaseSchema";
import type { PurchaseDetailInput } from "@/features/purchases/domain/purchaseRules";

export default function EditPurchasePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { products } = useProducts();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [defaultHeader, setDefaultHeader] = useState<PurchaseFormData | undefined>();
  const [defaultDetails, setDefaultDetails] = useState<PurchaseDetailInput[]>([]);

  useEffect(() => {
    (async () => {
      const [purchase, details] = await Promise.all([
        db.purchases.get(id),
        db.purchaseDetails.where("purchaseId").equals(id).toArray(),
      ]);
      if (!purchase) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setDefaultHeader({
        supplier: purchase.supplier,
        date: purchase.date,
        paymentMethod: purchase.paymentMethod,
        notes: purchase.notes,
        status: purchase.status,
      });
      setDefaultDetails(
        details.map((d: PurchaseDetail) => ({
          productId: d.productId,
          code: d.code,
          name: d.name,
          color: d.color,
          quantity: d.quantity,
          unitPrice: d.unitPrice,
        })),
      );
      setLoading(false);
    })();
  }, [id]);

  const handleSave = async (data: PurchaseFormData, details: PurchaseDetailInput[]) => {
    setSaving(true);
    try {
      await updatePurchase(id, { header: data, details });
      toast.success("Compra actualizada");
      router.push("/purchases");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar la compra");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="space-y-5"><p className="text-sm text-zinc-500 text-center py-10">Cargando...</p></div>;
  }

  if (notFound || !defaultHeader) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold">Editar Compra</h1>
        </div>
        <p className="text-sm text-zinc-500 text-center py-10">Compra no encontrada</p>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">Editar Compra</h1>
      </div>
      <PurchaseForm
        products={products}
        defaultHeader={defaultHeader}
        defaultDetails={defaultDetails}
        loading={saving}
        onSave={handleSave}
      />
    </motion.div>
  );
}
