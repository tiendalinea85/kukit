"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { FeedingForm } from "@/features/breeding/components/FeedingForm";
import { createFeeding } from "@/features/breeding/services/breedingService";
import { generateFeedingCode } from "@/utils/code";
import { db } from "@/lib/db";
import toast from "react-hot-toast";
import type { FeedingFormData } from "@/features/breeding/schemas/breedingSchema";

export default function NewFeedingPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    generateFeedingCode().then(setCode);
  }, []);

  const handleSubmit = async (data: FeedingFormData) => {
    setLoading(true);
    try {
      const lot = await db.breedingLots.get(data.lotId);
      await createFeeding(data, lot?.name || "", code);
      toast.success("Alimentación registrada exitosamente");
      router.push("/breeding");
    } catch {
      toast.error("Error al registrar alimentación");
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
        <h1 className="text-xl font-bold">Nueva Alimentación</h1>
      </div>
      <FeedingForm onSubmit={handleSubmit} loading={loading} code={code} />
    </motion.div>
  );
}
