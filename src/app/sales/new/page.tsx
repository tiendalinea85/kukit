"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { SaleForm } from "@/features/sales/components/SaleForm";
import { createSale } from "@/features/sales/services/saleService";
import { useCustomers } from "@/features/sales/hooks/useCustomers";
import { useProducts } from "@/features/sales/hooks/useProducts";
import toast from "react-hot-toast";
import type { SaleFormData } from "@/features/sales/schemas/saleSchema";
import type { SaleDetailInput } from "@/features/sales/domain/saleRules";

export default function NewSalePage() {
  const router = useRouter();
  const { customers } = useCustomers();
  const { products } = useProducts();
  const [loading, setLoading] = useState(false);

  const handleSave = async (data: SaleFormData, details: SaleDetailInput[], confirm: boolean) => {
    setLoading(true);
    try {
      const sale = await createSale({ header: data, details }, { confirm });
      toast.success(confirm ? `Venta ${sale.code} confirmada` : "Venta guardada como pendiente");
      router.push(`/sales/${sale.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar la venta");
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
        <h1 className="text-xl font-bold">Nueva Venta</h1>
      </div>
      <SaleForm customers={customers} products={products} loading={loading} onSave={handleSave} />
    </motion.div>
  );
}
