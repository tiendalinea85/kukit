"use client";
import { useState, useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { expenseSchema, type ExpenseFormData } from "../schemas/expenseSchema";
import { PAYMENT_METHODS } from "../domain/expenseRules";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { db } from "@/lib/db";
import toast from "react-hot-toast";
import type { Category } from "@/types";

const paymentMethodLabels: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta_credito: "Tarjeta de Crédito",
  tarjeta_debito: "Tarjeta de Débito",
  yape: "Yape",
  plin: "Plin",
  transferencia: "Transferencia",
  otro: "Otro",
};

const statusOptions = [
  { value: "pagado", label: "Pagado" },
  { value: "pendiente", label: "Pendiente" },
];

interface Props {
  onSubmit: (data: ExpenseFormData) => Promise<void>;
  defaultValues?: Partial<ExpenseFormData>;
  loading?: boolean;
  code?: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ExpenseForm({ onSubmit, defaultValues, loading, code }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    db.categories.toArray().then(setCategories);
  }, []);

  const defaultDate = new Date().toISOString().split("T")[0];
  const defaultTime = new Date().toTimeString().slice(0, 5);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema) as Resolver<ExpenseFormData>,
    defaultValues: {
      description: defaultValues?.description || "",
      amount: defaultValues?.amount ?? undefined,
      categoryId: defaultValues?.categoryId || "",
      paymentMethod: defaultValues?.paymentMethod ?? "efectivo",
      status: defaultValues?.status || "pagado",
      date: defaultValues?.date || defaultDate,
      time: defaultValues?.time || defaultTime,
      notes: defaultValues?.notes || "",
      receiptPhoto: defaultValues?.receiptPhoto || "",
    },
  });

  const receiptPhoto = watch("receiptPhoto");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Solo se permiten imágenes"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("La imagen no debe superar los 5MB"); return; }
    const base64 = await fileToBase64(file);
    setValue("receiptPhoto", base64);
  };

  if (!mounted) return null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {code && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800/40 border border-zinc-700/50">
          <span className="text-xs text-zinc-500">Código:</span>
          <span className="text-sm font-mono text-purple-400">{code}</span>
        </div>
      )}

      <Input label="Descripción" {...register("description")} error={errors.description?.message} placeholder="Ej: Pago de factura eléctrica" />

      <div className="grid grid-cols-2 gap-3">
        <Input label="Monto" type="number" step="0.01" min="0.01" {...register("amount")} error={errors.amount?.message} placeholder="0.00" />
        <Select label="Categoría" {...register("categoryId")} error={errors.categoryId?.message}
          placeholder="Seleccionar"
          options={categories.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Select label="Método de Pago" {...register("paymentMethod")} error={errors.paymentMethod?.message}
          placeholder="Seleccionar"
          options={PAYMENT_METHODS.map((m) => ({ value: m, label: paymentMethodLabels[m] || m }))}
        />
        <Select label="Estado" {...register("status")} options={statusOptions} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Fecha" type="date" {...register("date")} error={errors.date?.message} />
        <Input label="Hora" type="time" {...register("time")} error={errors.time?.message} />
      </div>

      <Input label="Observaciones" {...register("notes")} placeholder="Notas adicionales (opcional)" />

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-400">Comprobante (opcional)</label>
        {receiptPhoto ? (
          <div className="relative rounded-xl overflow-hidden border border-zinc-700/50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={receiptPhoto} alt="Comprobante" className="w-full max-h-48 object-contain bg-zinc-800/60" />
            <button type="button" onClick={() => setValue("receiptPhoto", "")}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-zinc-300 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <label className="flex items-center justify-center gap-2 w-full rounded-xl bg-zinc-800/60 border border-dashed border-zinc-700/50 p-4 cursor-pointer hover:bg-zinc-800 transition-colors">
            <Camera size={20} className="text-zinc-400" />
            <span className="text-sm text-zinc-400">Subir foto del comprobante</span>
            <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
          </label>
        )}
      </div>

      <Button type="submit" loading={loading} className="w-full">
        Guardar Gasto
      </Button>
    </form>
  );
}
