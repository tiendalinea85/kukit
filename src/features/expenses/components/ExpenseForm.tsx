"use client";
import { useState, useEffect, useRef } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { expenseSchema, type ExpenseFormData } from "../schemas/expenseSchema";
import { PAYMENT_METHODS, computeExpenseTotal, computeSubtotal } from "../domain/expenseRules";
import { Camera, X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { db } from "@/lib/db";
import { quickCreateProduct } from "../services/expenseService";
import { generateProductCode } from "@/utils/code";
import { formatCurrency } from "@/utils/format";
import toast from "react-hot-toast";
import type { Category, ExpenseDetailInput, Product } from "@/types";

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
  onSubmit: (data: ExpenseFormData, details: ExpenseDetailInput[]) => Promise<void>;
  defaultValues?: Partial<ExpenseFormData>;
  defaultDetails?: ExpenseDetailInput[];
  products?: Product[];
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

export function ExpenseForm({
  onSubmit,
  defaultValues,
  defaultDetails,
  products = [],
  loading,
  code,
}: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [mounted, setMounted] = useState(false);

  const [details, setDetails] = useState<ExpenseDetailInput[]>(defaultDetails ?? []);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [lineError, setLineError] = useState("");
  const [productModal, setProductModal] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const codeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const hasDetails = details.length > 0;
  const total = hasDetails ? computeExpenseTotal(details) : undefined;

  useEffect(() => {
    if (details.length > 0) {
      setValue("amount", computeExpenseTotal(details), { shouldValidate: true });
    }
  }, [details, setValue]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Solo se permiten imágenes"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("La imagen no debe superar los 5MB"); return; }
    const base64 = await fileToBase64(file);
    setValue("receiptPhoto", base64);
  };

  const addLine = () => {
    setLineError("");
    const product = products.find((p) => p.id === productId);
    if (!product) {
      setLineError("Selecciona un producto o crea uno nuevo");
      return;
    }
    const qty = Number(quantity);
    const price = Number(unitPrice);
    if (!Number.isFinite(qty) || qty <= 0) {
      setLineError("La cantidad debe ser mayor a 0");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setLineError("El precio no puede ser negativo");
      return;
    }

    const existing = details.find((d) => d.productId === productId);
    if (existing) {
      setDetails((prev) =>
        prev.map((d) =>
          d.productId === productId
            ? { ...d, quantity: d.quantity + qty, unitPrice: price }
            : d,
        ),
      );
    } else {
      setDetails((prev) => [
        ...prev,
        {
          productId: product.id,
          code: product.code,
          name: product.name,
          color: product.color,
          quantity: qty,
          unitPrice: price,
        },
      ]);
    }
    setProductId("");
    setQuantity("1");
    setUnitPrice("");
  };

  const openProductModal = () => {
    setNewCode("");
    setNewName("");
    setCodeTouched(false);
    setProductModal(true);
  };

  const handleNameChange = (value: string) => {
    setNewName(value);
    if (codeTouched) return;
    if (codeTimerRef.current) clearTimeout(codeTimerRef.current);
    codeTimerRef.current = setTimeout(() => {
      void (async () => {
        if (!value.trim()) {
          setNewCode("");
          return;
        }
        setNewCode(await generateProductCode(value.trim()));
      })();
    }, 400);
  };

  const handleCreateProduct = async () => {
    if (!newCode.trim() || !newName.trim()) {
      toast.error("Código y nombre son obligatorios");
      return;
    }
    setCreatingProduct(true);
    try {
      const created = await quickCreateProduct({ code: newCode, name: newName });
      setProductModal(false);
      setNewCode("");
      setNewName("");
      // Re-cargar productos desde la página (el padre recarga via liveQuery),
      // aquí simplemente seteamos el producto seleccionado si ya existe en la lista.
      const refreshed = await db.products.get(created.id);
      if (!refreshed?.deleted) {
        setProductId(created.id);
      }
      toast.success("Producto creado");
    } catch {
      toast.error("Error al crear el producto");
    } finally {
      setCreatingProduct(false);
    }
  };

  const submit = (data: ExpenseFormData) => {
    if (hasDetails && total != null) {
      void onSubmit({ ...data, amount: total }, details);
    } else {
      void onSubmit(data, details);
    }
  };

  if (!mounted) return null;

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      {code && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800/40 border border-zinc-700/50">
          <span className="text-xs text-zinc-500">Código:</span>
          <span className="text-sm font-mono text-purple-400">{code}</span>
        </div>
      )}

      <Input label="Descripción" {...register("description")} error={errors.description?.message} placeholder="Ej: Compra de materiales para tallo" />

      <div className="rounded-2xl bg-zinc-800/40 border border-zinc-800 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-zinc-300">Detalle del gasto</p>
          <span className="text-xs text-zinc-500">Opcional</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-3 flex gap-2">
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="flex-1 rounded-xl bg-zinc-800/60 border border-zinc-700/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-purple-500"
            >
              <option value="">Producto</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.name} {p.color ? `(${p.color})` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={openProductModal}
              title="Crear nuevo producto"
              className="shrink-0 rounded-xl bg-zinc-700/60 hover:bg-zinc-700 flex items-center justify-center px-3 text-zinc-300"
            >
              <Plus size={18} />
            </button>
          </div>
          <input
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            type="number"
            step="any"
            min="1"
            placeholder="Cant."
            className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-purple-500"
          />
          <input
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            type="number"
            step="any"
            min="0"
            placeholder="Precio"
            className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-purple-500"
          />
          <button
            type="button"
            onClick={addLine}
            className="rounded-xl bg-purple-600/80 hover:bg-purple-600 flex items-center justify-center gap-1 text-sm font-medium py-2"
          >
            <Plus size={15} /> Agregar
          </button>
        </div>
        {lineError && <p className="text-xs text-red-400">{lineError}</p>}

        {hasDetails && (
          <div className="space-y-2 pt-1">
            {details.map((d) => (
              <div key={d.productId} className="flex items-center justify-between rounded-xl bg-zinc-900/60 border border-zinc-800 p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-zinc-200 truncate">{d.name} <span className="text-zinc-500">({d.code})</span></p>
                  <p className="text-xs text-zinc-500">{d.color || "Sin color"} · {d.quantity} × {formatCurrency(d.unitPrice)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-zinc-200">{formatCurrency(computeSubtotal(d.quantity, d.unitPrice))}</span>
                  <button
                    type="button"
                    onClick={() => setDetails((prev) => prev.filter((x) => x.productId !== d.productId))}
                    className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
              <span className="text-sm text-zinc-400">Total</span>
              <span className="text-lg font-bold text-purple-400">{formatCurrency(total ?? 0)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Monto"
          type="number"
          step="0.01"
          min="0.01"
          disabled={hasDetails}
          {...register("amount")}
          error={errors.amount?.message}
          placeholder="0.00"
        />
        {hasDetails && <p className="col-span-2 text-xs text-zinc-500 -mt-2">El monto se calcula automáticamente según los detalles del gasto.</p>}
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

      <Modal open={productModal} onClose={() => setProductModal(false)} title="Nuevo Producto">
        <div className="space-y-4">
          <Input
            label="Nombre"
            value={newName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Ej: Rollo de tela"
          />
          <Input
            label="Código (automático, puedes editarlo)"
            value={newCode}
            onChange={(e) => {
              setCodeTouched(true);
              setNewCode(e.target.value);
            }}
            placeholder="Se genera desde el nombre"
          />
          <Button type="button" loading={creatingProduct} className="w-full" onClick={handleCreateProduct}>
            Crear Producto
          </Button>
        </div>
      </Modal>
    </form>
  );
}