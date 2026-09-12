"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { createVehicleBrand } from "@/features/autoparts/services/autopartsService";
import { vehicleBrandSchema, type VehicleBrandFormData } from "@/features/autoparts/schemas/autopartsSchema";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import toast from "react-hot-toast";

export default function NewBrandPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; country?: string }>({});

  const handleSubmit = async () => {
    const result = vehicleBrandSchema.safeParse({ name, country });
    if (!result.success) {
      const fieldErrors: { name?: string; country?: string } = {};
      for (const issue of result.error.issues) {
        if (issue.path[0] === "name") fieldErrors.name = issue.message;
        if (issue.path[0] === "country") fieldErrors.country = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      await createVehicleBrand(result.data);
      toast.success("Marca creada exitosamente");
      router.push("/autoparts");
    } catch {
      toast.error("Error al crear marca");
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
        <h1 className="text-xl font-bold">Nueva Marca</h1>
      </div>

      <div className="space-y-4">
        <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="Ej: Toyota" />
        <Input label="País" value={country} onChange={(e) => setCountry(e.target.value)} error={errors.country} placeholder="Ej: Japón" />
        <Button onClick={handleSubmit} loading={loading} className="w-full">
          Guardar Marca
        </Button>
      </div>
    </motion.div>
  );
}
