"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { createVehicleModel } from "@/features/autoparts/services/autopartsService";
import { vehicleModelSchema, type VehicleModelFormData } from "@/features/autoparts/schemas/autopartsSchema";
import { useVehicleBrands } from "@/features/autoparts/hooks/useAutoparts";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import toast from "react-hot-toast";

export default function NewModelPage() {
  const router = useRouter();
  const { brands } = useVehicleBrands();
  const [formData, setFormData] = useState<VehicleModelFormData>({
    brandId: "",
    name: "",
    startYear: new Date().getFullYear(),
    endYear: null,
    engine: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async () => {
    const result = vehicleModelSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as string;
        fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      await createVehicleModel(result.data);
      toast.success("Modelo creado exitosamente");
      router.push("/autoparts");
    } catch {
      toast.error("Error al crear modelo");
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: keyof VehicleModelFormData, value: VehicleModelFormData[keyof VehicleModelFormData]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">Nuevo Modelo</h1>
      </div>

      <div className="space-y-4">
        <Select label="Marca" value={formData.brandId} onChange={(e) => updateField("brandId", e.target.value)}
          error={errors.brandId} placeholder="Seleccionar marca"
          options={brands.map((b) => ({ value: b.id, label: b.name }))}
        />
        <Input label="Nombre del modelo" value={formData.name} onChange={(e) => updateField("name", e.target.value)}
          error={errors.name} placeholder="Ej: Corolla"
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Año inicio" type="number" min="1900" max="2100" value={formData.startYear} onChange={(e) => updateField("startYear", Number(e.target.value))} error={errors.startYear} />
          <Input label="Año fin (opcional)" type="number" min="1900" max="2100" value={formData.endYear ?? ""} onChange={(e) => updateField("endYear", e.target.value ? Number(e.target.value) : null)} error={errors.endYear} placeholder="Actual" />
        </div>
        <Input label="Motor" value={formData.engine} onChange={(e) => updateField("engine", e.target.value)} error={errors.engine} placeholder="Ej: 1.8L VVT-i" />
        <Input label="Observaciones" value={formData.notes} onChange={(e) => updateField("notes", e.target.value)} placeholder="Notas adicionales (opcional)" />
        <Button onClick={handleSubmit} loading={loading} className="w-full">
          Guardar Modelo
        </Button>
      </div>
    </motion.div>
  );
}
