"use client";
import { useState, useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { investmentSchema, type InvestmentFormData } from "../schemas/investmentSchema";
import { PAYMENT_METHODS } from "../../expenses/domain/expenseRules";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { db } from "@/lib/db";
import type { InvestmentCategory } from "@/types";

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
  onSubmit: (data: InvestmentFormData) => Promise<void>;
  defaultValues?: Partial<InvestmentFormData>;
  loading?: boolean;
}

export function InvestmentForm({ onSubmit, defaultValues, loading }: Props) {
  const [categories, setCategories] = useState<InvestmentCategory[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    db.investmentCategories.toArray().then(setCategories);
  }, []);

  const defaultDate = new Date().toISOString().split("T")[0];

  const { register, handleSubmit, formState: { errors } } = useForm<InvestmentFormData>({
    resolver: zodResolver(investmentSchema) as Resolver<InvestmentFormData>,
    defaultValues: {
      name: defaultValues?.name || "",
      value: defaultValues?.value ?? undefined,
      categoryId: defaultValues?.categoryId || "",
      supplier: defaultValues?.supplier || "",
      paymentMethod: defaultValues?.paymentMethod ?? "efectivo",
      status: defaultValues?.status || "pagado",
      date: defaultValues?.date || defaultDate,
      notes: defaultValues?.notes || "",
    },
  });

  if (!mounted) return null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input label="Nombre" {...register("name")} error={errors.name?.message} placeholder="Ej: Máquina de coser industrial" />

      <div className="grid grid-cols-2 gap-3">
        <Input label="Valor" type="number" step="0.01" min="0.01" {...register("value")} error={errors.value?.message} placeholder="0.00" />
        <Select label="Categoría" {...register("categoryId")} error={errors.categoryId?.message}
          placeholder="Seleccionar"
          options={categories.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))}
        />
      </div>

      <Input label="Proveedor (opcional)" {...register("supplier")} error={errors.supplier?.message} placeholder="Ej: Importadora Andina S.A." />

      <div className="grid grid-cols-2 gap-3">
        <Select label="Método de Pago" {...register("paymentMethod")} error={errors.paymentMethod?.message}
          placeholder="Seleccionar"
          options={PAYMENT_METHODS.map((m) => ({ value: m, label: paymentMethodLabels[m] || m }))}
        />
        <Select label="Estado" {...register("status")} options={statusOptions} />
      </div>

      <Input label="Fecha" type="date" {...register("date")} error={errors.date?.message} />

      <Input label="Observaciones" {...register("notes")} error={errors.notes?.message} placeholder="Notas adicionales (opcional)" />

      <Button type="submit" loading={loading} className="w-full">
        Guardar Inversión
      </Button>
    </form>
  );
}
