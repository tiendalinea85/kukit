"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, ShoppingBag } from "lucide-react";
import { saleSchema, type SaleFormData } from "../schemas/saleSchema";
import { computeSubtotal, computeSaleTotal } from "../domain/saleRules";
import type { SaleDetailInput } from "../domain/saleRules";
import type { Customer, PaymentMethod } from "@/types";
import type { ProductWithStock } from "../services/productService";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PAYMENT_METHODS } from "../../expenses/domain/expenseRules";
import { formatCurrency } from "@/utils/format";

interface Props {
  customers: Customer[];
  products: ProductWithStock[];
  defaultHeader?: SaleFormData;
  defaultDetails?: SaleDetailInput[];
  loading?: boolean;
  onSave: (data: SaleFormData, details: SaleDetailInput[], confirm: boolean) => Promise<void>;
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  tarjeta_credito: "Tarjeta crédito",
  tarjeta_debito: "Tarjeta débito",
  yape: "Yape",
  plin: "Plin",
  transferencia: "Transferencia",
  otro: "Otro",
};

export function SaleForm({ customers, products, defaultHeader, defaultDetails, loading, onSave }: Props) {
  const { register, handleSubmit, getValues, formState: { errors } } = useForm<SaleFormData>({
    resolver: zodResolver(saleSchema),
    defaultValues: defaultHeader || {
      customerId: "",
      date: new Date().toISOString().slice(0, 10),
      paymentMethod: "efectivo",
      notes: "",
    },
  });

  const [details, setDetails] = useState<SaleDetailInput[]>(defaultDetails ?? []);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [lineError, setLineError] = useState("");

  const total = computeSaleTotal(details);

  const addLine = () => {
    setLineError("");
    const product = products.find((p) => p.id === productId);
    if (!product) {
      setLineError("Selecciona un producto");
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

  const save = (confirm: boolean) => {
    const valid = details.length > 0;
    setLineError(valid ? "" : "Agrega al menos un producto");
    if (!valid) return;
    void onSave(getValues(), details, confirm);
  };

  return (
    <form onSubmit={handleSubmit((data) => onSave(data, details, false))} className="space-y-4">
      <div>
        <label className="text-sm font-medium text-zinc-400">Cliente</label>
        <select
          {...register("customerId")}
          className="w-full rounded-xl bg-zinc-800/60 border border-zinc-700/50 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 outline-none transition-all focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50"
        >
          <option value="">Selecciona un cliente</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {errors.customerId && <p className="text-xs text-red-400 mt-1">{errors.customerId.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Fecha" type="date" {...register("date")} error={errors.date?.message} />
        <div>
          <label className="text-sm font-medium text-zinc-400">Método de pago</label>
          <select
            {...register("paymentMethod")}
            className="w-full rounded-xl bg-zinc-800/60 border border-zinc-700/50 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 outline-none transition-all focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50"
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{PAYMENT_LABELS[m]}</option>
            ))}
          </select>
          {errors.paymentMethod && <p className="text-xs text-red-400 mt-1">{errors.paymentMethod.message}</p>}
        </div>
      </div>

      <Input label="Observaciones" {...register("notes")} error={errors.notes?.message} placeholder="Opcional" />

      <div className="rounded-2xl bg-zinc-800/40 border border-zinc-800 p-4 space-y-3">
        <p className="text-sm font-semibold text-zinc-300">Detalle de la venta</p>

        <div className="grid grid-cols-3 gap-2">
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="col-span-3 rounded-xl bg-zinc-800/60 border border-zinc-700/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-purple-500"
          >
            <option value="">Producto</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} - {p.name} ({p.color || "sin color"}) · stock {p.stock}
              </option>
            ))}
          </select>
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

        {details.length > 0 && (
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
              <span className="text-lg font-bold text-purple-400">{formatCurrency(total)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <Button type="submit" variant="secondary" loading={loading} className="w-full">
          Guardar venta
        </Button>
        <Button type="button" loading={loading} className="w-full" onClick={() => save(true)}>
          <ShoppingBag size={16} /> Confirmar
        </Button>
      </div>
    </form>
  );
}
