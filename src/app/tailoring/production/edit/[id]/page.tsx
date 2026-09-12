"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Lock } from "lucide-react";
import { ProductionOrderForm } from "@/features/tailoring/components/ProductionOrderForm";
import { updateProductionOrder } from "@/features/tailoring/services/tailoringService";
import { canVoidProduction } from "@/features/tailoring/domain/tailoringRules";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";
import type { ProductionOrderFormData } from "@/features/tailoring/schemas/tailoringSchema";
import type { ProductionOrder, ProductionMaterial } from "@/types/modules";

interface MaterialRow {
  id: string;
  materialId: string;
  materialName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export default function EditProductionOrderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [orderMaterials, setOrderMaterials] = useState<ProductionMaterial[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    db.productionOrders.get(id).then((o) => {
      if (o) {
        setOrder(o);
        db.productionMaterials
          .where("productionOrderId")
          .equals(o.id)
          .toArray()
          .then(setOrderMaterials);
      }
    });
  }, [id]);

  const handleSubmit = async (data: ProductionOrderFormData, _materials: MaterialRow[]) => {
    if (!order) return;
    setLoading(true);
    try {
      await updateProductionOrder(order.id, data);
      toast.success("Orden actualizada");
      router.push("/tailoring");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setLoading(false);
    }
  };

  if (!order) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!canVoidProduction(order)) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold">Editar Orden</h1>
        </div>
        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-8 text-center space-y-3">
          <Lock size={28} className="mx-auto text-zinc-600" />
          <p className="text-zinc-300 font-medium">Esta orden no puede editarse</p>
          <p className="text-sm text-zinc-500">La orden está anulada.</p>
          <Button variant="secondary" className="mx-auto" onClick={() => router.push("/tailoring")}>
            Volver
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
        <h1 className="text-xl font-bold">Editar Orden de Producción</h1>
      </div>

      <ProductionOrderForm
        onSubmit={handleSubmit}
        loading={loading}
        code={order.code}
        defaultMaterials={orderMaterials}
        defaultValues={{
          garmentId: order.garmentId,
          sizeId: order.sizeId,
          colorId: order.colorId,
          quantity: order.quantity,
          unitCost: order.unitCost,
          startDate: order.startDate,
          dueDate: order.dueDate,
          notes: order.notes,
        }}
      />
    </motion.div>
  );
}
