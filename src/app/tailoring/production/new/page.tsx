"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { ProductionOrderForm } from "@/features/tailoring/components/ProductionOrderForm";
import { createProductionOrder, addProductionMaterial } from "@/features/tailoring/services/tailoringService";
import { generateProductionCode } from "@/utils/code";
import { db } from "@/lib/db";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import toast from "react-hot-toast";
import type { ProductionOrderFormData } from "@/features/tailoring/schemas/tailoringSchema";

interface MaterialRow {
  id: string;
  materialId: string;
  materialName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export default function NewProductionOrderPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  useEffect(() => {
    generateProductionCode().then(setCode);
  }, []);

  const handleSubmit = async (data: ProductionOrderFormData, materials: MaterialRow[]) => {
    setLoading(true);
    try {
      const garments = await db.garments
        .where("workspaceId").equals(workspaceId || "")
        .and((g) => !g.deleted)
        .toArray();
      const sizes = await db.sizes
        .where("workspaceId").equals(workspaceId || "")
        .and((s) => !s.deleted)
        .toArray();
      const colors = await db.garmentColors
        .where("workspaceId").equals(workspaceId || "")
        .and((c) => !c.deleted)
        .toArray();

      const garment = garments.find((g) => g.id === data.garmentId);
      const size = sizes.find((s) => s.id === data.sizeId);
      const color = colors.find((c) => c.id === data.colorId);

      const order = await createProductionOrder(
        data,
        garment?.name || "",
        size?.name || "",
        color?.name || "",
        code
      );

      for (const mat of materials) {
        if (!mat.materialId) continue;
        await addProductionMaterial({
          productionOrderId: order.id,
          materialId: mat.materialId,
          materialName: mat.materialName,
          quantity: mat.quantity,
          unitCost: mat.unitCost,
        });
      }

      toast.success("Orden de producción creada");
      router.push("/tailoring");
    } catch {
      toast.error("Error al crear orden");
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
        <h1 className="text-xl font-bold">Nueva Orden de Producción</h1>
      </div>
      <ProductionOrderForm onSubmit={handleSubmit} loading={loading} code={code} />
    </motion.div>
  );
}
