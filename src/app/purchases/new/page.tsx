"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { PurchaseForm } from "@/features/purchases/components/PurchaseForm";
import { createPurchase } from "@/features/purchases/services/purchaseService";
import { useProducts } from "@/features/sales/hooks/useProducts";
import toast from "react-hot-toast";
import type { PurchaseFormData } from "@/features/purchases/schemas/purchaseSchema";
import type { PurchaseDetailInput } from "@/features/purchases/domain/purchaseRules";

export default function NewPurchasePage() {
  const router = useRouter();
  const { products } = useProducts();
  const [loading, setLoading] = useState(false);

  const handleSave = async (data: PurchaseFormData, details: PurchaseDetailInput[], receive: boolean) => {
    setLoading(true);
    try {
      const purchase = await createPurchase({ header: data, details }, { receive });
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
        <h1 className="text-xl font-bold">Nueva Compra</h1>
      </div>
      <PurchaseForm products={products} loading={loading} onSave={handleSave} />
    </motion.div>
  );
}
