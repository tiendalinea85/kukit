"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Lock } from "lucide-react";
import { SaleForm } from "@/features/sales/components/SaleForm";
import { updateSale } from "@/features/sales/services/saleService";
import { isVoided } from "@/features/sales/domain/saleRules";
import { useCustomers } from "@/features/sales/hooks/useCustomers";
import { useProducts } from "@/features/sales/hooks/useProducts";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";
import type { SaleFormData } from "@/features/sales/schemas/saleSchema";
import type { SaleDetailInput } from "@/features/sales/domain/saleRules";
import type { Sale, SaleDetail } from "@/types";

export default function EditSalePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { customers } = useCustomers();
  const { products } = useProducts();
  const [sale, setSale] = useState<Sale | null>(null);
  const [details, setDetails] = useState<SaleDetail[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    db.sales.get(id).then((s) => {
      if (!s) return;
      setSale(s);
      db.saleDetails.where("saleId").equals(id).toArray().then(setDetails);
    });
  }, [id]);

  const handleSubmit = async (data: SaleFormData, detailInputs: SaleDetailInput[]) => {
    if (!sale) return;
    setLoading(true);
    try {
      await updateSale(sale.id, { header: data, details: detailInputs });
      toast.success("Venta actualizada");
      router.push(`/sales/${sale.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setLoading(false);
    }
  };

  if (!sale) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isVoided(sale) || sale.status === "confirmada") {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold">Editar Venta</h1>
        </div>
        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-8 text-center space-y-3">
          <Lock size={28} className="mx-auto text-zinc-600" />
          <p className="text-zinc-300 font-medium">
            {isVoided(sale) ? "Esta venta está anulada" : "Esta venta ya fue confirmada"}
          </p>
          <p className="text-sm text-zinc-500">Una venta confirmada conserva su historial y no puede editarse.</p>
          <Button variant="secondary" className="mx-auto" onClick={() => router.push(`/sales/${sale.id}`)}>
            Ver detalle
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">Editar Venta {sale.code}</h1>
      </div>

      <SaleForm
        customers={customers}
        products={products}
        loading={loading}
        onSave={handleSubmit}
        defaultHeader={{
          customerId: sale.customerId,
          date: sale.date,
          paymentMethod: sale.paymentMethod,
          notes: sale.notes,
        }}
        defaultDetails={details.map((d) => ({
          productId: d.productId,
          code: d.code,
          name: d.name,
          color: d.color,
          quantity: d.quantity,
          unitPrice: d.unitPrice,
        }))}
      />
    </motion.div>
  );
}
