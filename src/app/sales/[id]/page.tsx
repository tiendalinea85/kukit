"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Edit2, Trash2, Ban, ReceiptText, CheckCircle2 } from "lucide-react";
import { db } from "@/lib/db";
import { formatCurrency, formatDate } from "@/utils/format";
import { voidSale, deleteSale } from "@/features/sales/services/saleService";
import { canEditSale, canVoidSale, isConfirmed, isVoided } from "@/features/sales/domain/saleRules";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import toast from "react-hot-toast";
import Link from "next/link";
import type { Sale, SaleDetail, Customer, PaymentMethod } from "@/types";

const paymentMethodLabels: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  tarjeta_credito: "Tarjeta de Crédito",
  tarjeta_debito: "Tarjeta de Débito",
  yape: "Yape",
  plin: "Plin",
  transferencia: "Transferencia",
  otro: "Otro",
};

const statusLabel: Record<string, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  anulada: "Anulada",
};

export default function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [sale, setSale] = useState<Sale | null>(null);
  const [details, setDetails] = useState<SaleDetail[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const reload = () => {
    db.sales.get(id).then((s) => {
      if (!s) return;
      setSale(s);
      db.customers.get(s.customerId).then((c) => c && !c.deleted && setCustomer(c));
    });
    db.saleDetails.where("saleId").equals(id).toArray().then(setDetails);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!sale) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleVoid = async () => {
    try {
      await voidSale(sale.id);
      toast.success(isConfirmed(sale) ? "Venta anulada (inventario restaurado)" : "Venta anulada");
      setVoidOpen(false);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo anular");
    }
  };

  const handleDelete = async () => {
    await deleteSale(sale.id);
    toast.success("Venta eliminada");
    setDeleteOpen(false);
    router.push("/sales");
  };

  const handleConfirm = async () => {
    try {
      const { confirmSale } = await import("@/features/sales/services/saleService");
      await confirmSale(sale.id);
      toast.success("Venta confirmada · inventario actualizado");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo confirmar");
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">Detalle de la Venta</h1>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-900/50 border border-zinc-800 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs text-purple-500 bg-purple-600/10 px-3 py-1 rounded-lg">
            <ReceiptText size={14} /> VENTA {sale.code}
          </span>
          <span className={`text-xs px-3 py-1 rounded-full flex items-center gap-1 ${
            sale.status === "confirmada" ? "bg-emerald-600/20 text-emerald-400" :
            sale.status === "pendiente" ? "bg-amber-600/20 text-amber-400" :
            "bg-red-600/20 text-red-400"
          }`}>
            {sale.status === "confirmada" && <CheckCircle2 size={12} />}
            {statusLabel[sale.status] || sale.status}
          </span>
        </div>

        <div>
          <h2 className="text-2xl font-bold">{customer?.name ?? "Cliente eliminado"}</h2>
          {sale.notes && <p className="text-zinc-400 text-sm mt-1">{sale.notes}</p>}
        </div>

        <p className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          {formatCurrency(sale.total)}
        </p>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-zinc-500">Fecha</p>
            <p className="text-zinc-200">{formatDate(sale.date)}</p>
          </div>
          <div>
            <p className="text-zinc-500">Método de Pago</p>
            <p className="text-zinc-200">{paymentMethodLabels[sale.paymentMethod] || sale.paymentMethod}</p>
          </div>
          {customer?.phone && (
            <div>
              <p className="text-zinc-500">Teléfono</p>
              <p className="text-zinc-200">{customer.phone}</p>
            </div>
          )}
          {customer?.address && (
            <div>
              <p className="text-zinc-500">Dirección</p>
              <p className="text-zinc-200">{customer.address}</p>
            </div>
          )}
          {sale.confirmedAt && (
            <div>
              <p className="text-zinc-500">Confirmada</p>
              <p className="text-zinc-200 text-xs">{formatDate(sale.confirmedAt)}</p>
            </div>
          )}
          {isVoided(sale) && sale.voidedAt && (
            <div>
              <p className="text-zinc-500">Anulada</p>
              <p className="text-zinc-200 text-xs">{formatDate(sale.voidedAt)}</p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-4 space-y-2">
        <p className="text-sm font-semibold text-zinc-300">Detalle de productos</p>
        {details.map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded-xl bg-zinc-800/40 border border-zinc-800 p-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium text-zinc-200 truncate">{d.name} <span className="text-zinc-500">({d.code})</span></p>
              <p className="text-xs text-zinc-500">{d.color || "Sin color"} · {d.quantity} × {formatCurrency(d.unitPrice)}</p>
            </div>
            <span className="font-semibold text-zinc-200 ml-3">{formatCurrency(d.subtotal)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
          <span className="text-sm text-zinc-400">Total</span>
          <span className="text-lg font-bold text-purple-400">{formatCurrency(sale.total)}</span>
        </div>
      </div>

      {isVoided(sale) && (
        <div className="rounded-xl bg-red-600/10 border border-red-600/30 p-3 text-sm text-red-400">
          Esta venta fue anulada y no puede modificarse.
        </div>
      )}

      <div className="flex gap-3">
        {sale.status === "pendiente" && (
          <Button className="flex-1" onClick={handleConfirm}>
            <CheckCircle2 size={16} /> Confirmar venta
          </Button>
        )}
        {canEditSale(sale.status) && (
          <Link href={`/sales/edit/${sale.id}`} className="flex-1">
            <Button variant="secondary" className="w-full"><Edit2 size={16} /> Editar</Button>
          </Link>
        )}
        {canVoidSale(sale.status) && (
          <Button variant="danger" className="flex-1" onClick={() => setVoidOpen(true)}>
            <Ban size={16} /> Anular
          </Button>
        )}
        <Button variant="ghost" className="flex-1" onClick={() => setDeleteOpen(true)}>
          <Trash2 size={16} /> Eliminar
        </Button>
      </div>

      <Modal open={voidOpen} onClose={() => setVoidOpen(false)} title="Anular Venta">
        <p className="text-zinc-400 mb-4">
          ¿Anular la venta <strong className="text-zinc-200">{sale.code}</strong> por <strong className="text-zinc-200">{formatCurrency(sale.total)}</strong>?
          {isConfirmed(sale) && " El inventario será restaurado automáticamente."}
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setVoidOpen(false)}>Cancelar</Button>
          <Button variant="danger" className="flex-1" onClick={handleVoid}>Anular</Button>
        </div>
      </Modal>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Eliminar Venta">
        <p className="text-zinc-400 mb-4">¿Enviar esta venta a la papelera? Puedes recuperarla desde ahí.</p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
          <Button variant="danger" className="flex-1" onClick={handleDelete}>Eliminar</Button>
        </div>
      </Modal>
    </motion.div>
  );
}
