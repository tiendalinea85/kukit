"use client";
import { useState, useEffect, useCallback } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { expenseSchema, type ExpenseFormData } from "../schemas/expenseSchema";
import { Camera, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ExpenseItemsTable } from "./ExpenseItemsTable";
import { ExpenseSummaryCard } from "./ExpenseSummaryCard";
import { db } from "@/lib/db";
import toast from "react-hot-toast";
import type { Category, Type } from "@/types";

interface DetailItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

const paymentMethods = [
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta_credito", label: "Tarjeta de Crédito" },
  { value: "tarjeta_debito", label: "Tarjeta de Débito" },
  { value: "yape", label: "Yape" },
  { value: "plin", label: "Plin" },
  { value: "transferencia", label: "Transferencia" },
  { value: "otro", label: "Otro" },
];

const statuses = [
  { value: "activo", label: "Activo" },
  { value: "pagado", label: "Pagado" },
  { value: "pendiente", label: "Pendiente" },
  { value: "cancelado", label: "Cancelado" },
];

interface Props {
  onSubmit: (data: ExpenseFormData) => Promise<void>;
  defaultValues?: ExpenseFormData;
  defaultDetails?: DetailItem[];
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

export function ExpenseForm({ onSubmit, defaultValues, defaultDetails, loading, code }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [types, setTypes] = useState<Type[]>([]);
  const [mounted, setMounted] = useState(false);
  const [details, setDetails] = useState<DetailItem[]>(defaultDetails || []);
  const [showDetails, setShowDetails] = useState(
    defaultValues?.hasDetails || (defaultDetails && defaultDetails.length > 0) || false
  );

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    db.categories.toArray().then(setCategories);
    db.types.toArray().then(setTypes);
  }, []);

  const defaultDate = new Date().toISOString().split("T")[0];
  const defaultTime = new Date().toTimeString().slice(0, 5);

  const { register, handleSubmit, setValue, control, formState: { errors }, setError, clearErrors } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema) as any,
    defaultValues: {
      name: defaultValues?.name || "",
      description: defaultValues?.description || "",
      amount: defaultValues?.amount ?? undefined,
      categoryId: defaultValues?.categoryId || "",
      typeId: defaultValues?.typeId || "",
      paymentMethod: defaultValues?.paymentMethod || "",
      status: (defaultValues?.status as any) || "activo",
      date: defaultValues?.date || defaultDate,
      time: defaultValues?.time || defaultTime,
      notes: defaultValues?.notes || "",
      invoicePhoto: defaultValues?.invoicePhoto || "",
      hasDetails: defaultValues?.hasDetails ?? false,
      details: defaultValues?.details || ([] as any),
    },
  });

  useEffect(() => {
    setValue("details", details as any, { shouldValidate: false, shouldDirty: false });
  }, [details, setValue]);

  const invoicePhoto = useWatch({ control, name: "invoicePhoto" });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Solo se permiten imágenes"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("La imagen no debe superar los 5MB"); return; }
    const base64 = await fileToBase64(file);
    setValue("invoicePhoto", base64);
  };

  const removePhoto = () => {
    setValue("invoicePhoto", "");
  };

  const updateDetail = useCallback((index: number, field: keyof DetailItem, value: string | number) => {
    setDetails((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };
      if (field === "quantity" || field === "unitPrice") {
        const numVal = typeof value === "string" ? parseFloat(value) || 0 : value;
        item[field] = numVal;
        item.subtotal = item.quantity * item.unitPrice;
      } else if (field === "productName") {
        item.productName = String(value);
      }
      updated[index] = item;
      return updated;
    });
  }, []);

  const removeDetail = useCallback((index: number) => {
    setDetails((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addDetail = useCallback(() => {
    setDetails((prev) => [
      ...prev,
      { id: crypto.randomUUID(), productName: "", quantity: 0, unitPrice: 0, subtotal: 0 },
    ]);
  }, []);

  const totalAmount = details.reduce((s, d) => s + d.subtotal, 0);
  const itemsCount = details.length;

  const toggleDetails = useCallback((value: boolean) => {
    setShowDetails(value);
    setValue("hasDetails", value);
    if (!value) {
      setDetails([]);
      clearErrors("details");
    }
  }, [setValue, clearErrors]);

  const onFormSubmit = async (data: ExpenseFormData) => {
    if (showDetails) {
      if (details.length === 0) {
        setError("details", { message: "Debe agregar al menos un concepto" });
        return;
      }
      const hasEmpty = details.some((d) => !d.productName.trim());
      if (hasEmpty) {
        setError("details", { message: "Complete todos los conceptos" });
        return;
      }
      const hasNegativeQty = details.some((d) => d.quantity < 0);
      if (hasNegativeQty) {
        setError("details", { message: "Las cantidades no pueden ser negativas" });
        return;
      }
      const hasNegativePrice = details.some((d) => d.unitPrice < 0);
      if (hasNegativePrice) {
        setError("details", { message: "Los precios no pueden ser negativos" });
        return;
      }
      data.hasDetails = true;
      data.details = details.map((d) => ({ ...d }));
      data.amount = totalAmount;
    } else {
      data.hasDetails = false;
      data.details = [];
      if (!data.amount || data.amount <= 0) {
        setError("amount", { message: "El monto debe ser mayor a 0" });
        return;
      }
    }
    await onSubmit(data);
  };

  if (!mounted) return null;

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      {code && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800/40 border border-zinc-700/50">
          <span className="text-xs text-zinc-500">Código:</span>
          <span className="text-sm font-mono text-purple-400">{code}</span>
        </div>
      )}

      <Input label="Nombre del gasto" {...register("name")} error={errors.name?.message} placeholder="Ej: Compra de víveres" />

      <Input label="Descripción" {...register("description")} placeholder="Descripción opcional" />

      <div className="grid grid-cols-2 gap-3">
        <Select label="Categoría" {...register("categoryId")} error={errors.categoryId?.message}
          placeholder="Seleccionar"
          options={categories.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))}
        />
        <Select label="Tipo" {...register("typeId")} error={errors.typeId?.message}
          placeholder="Seleccionar"
          options={types.map((t) => ({ value: t.id, label: t.name }))}
        />
      </div>

      <Select label="Método de Pago" {...register("paymentMethod")} error={errors.paymentMethod?.message}
        placeholder="Seleccionar"
        options={paymentMethods}
      />

      <Select label="Estado" {...register("status")} options={statuses} />

      <div className="grid grid-cols-2 gap-3">
        <Input label="Fecha" type="date" {...register("date")} error={errors.date?.message} />
        <Input label="Hora" type="time" {...register("time")} error={errors.time?.message} />
      </div>

      <div className="rounded-xl bg-zinc-800/30 border border-zinc-700/50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-zinc-400">¿Este gasto tiene detalle?</label>
          <div className="flex items-center gap-2 bg-zinc-800/60 rounded-lg p-1">
            <button
              type="button"
              onClick={() => toggleDetails(false)}
              className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                !showDetails
                  ? "bg-zinc-700 text-zinc-100 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              No
            </button>
            <button
              type="button"
              onClick={() => toggleDetails(true)}
              className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                showDetails
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Sí
            </button>
          </div>
        </div>

        {showDetails ? (
          <div className="space-y-4">
            <ExpenseItemsTable
              items={details}
              onUpdate={updateDetail}
              onRemove={removeDetail}
              onAdd={addDetail}
              error={errors.details?.message as string}
            />
            {details.length > 0 && (
              <ExpenseSummaryCard total={totalAmount} itemsCount={itemsCount} hasDetails />
            )}
          </div>
        ) : (
          <Input
            label="Total del gasto"
            type="number"
            step="0.01"
            {...register("amount")}
            error={errors.amount?.message}
            placeholder="0.00"
          />
        )}
      </div>

      <Input label="Observaciones" {...register("notes")} placeholder="Notas adicionales" />

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-400">Foto de factura</label>
        {invoicePhoto ? (
          <div className="relative rounded-xl overflow-hidden border border-zinc-700/50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={invoicePhoto} alt="Factura" className="w-full max-h-48 object-contain bg-zinc-800/60" />
            <button type="button" onClick={removePhoto}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-zinc-300 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <label className="flex items-center justify-center gap-2 w-full rounded-xl bg-zinc-800/60 border border-dashed border-zinc-700/50 p-4 cursor-pointer hover:bg-zinc-800 transition-colors">
            <Camera size={20} className="text-zinc-400" />
            <span className="text-sm text-zinc-400">Subir foto</span>
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
