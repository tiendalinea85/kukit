"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { InvestmentForm } from "@/features/investments/components/InvestmentForm";
import { createInvestment } from "@/features/investments/services/investmentService";
import toast from "react-hot-toast";
import type { InvestmentFormData } from "@/features/investments/schemas/investmentSchema";

export default function NewInvestmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data: InvestmentFormData) => {
    setLoading(true);
    try {
      await createInvestment(data);
      toast.success("Inversión registrada exitosamente");
      router.push("/investments");
    } catch {
      toast.error("Error al registrar inversión");
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
        <h1 className="text-xl font-bold">Nueva Inversión</h1>
      </div>
      <InvestmentForm onSubmit={handleSubmit} loading={loading} />
    </motion.div>
  );
}
