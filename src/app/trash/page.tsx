"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { RotateCcw, Trash2 } from "lucide-react";
import { liveQuery } from "dexie";
import { db } from "@/lib/db";
import { formatCurrency, formatDate } from "@/utils/format";
import toast from "react-hot-toast";
import type { Expense, Investment, Customer, Product, Sale } from "@/types";

type TrashKind = "expense" | "investment" | "customer" | "product" | "sale";

interface TrashItem {
  id: string;
  kind: TrashKind;
  title: string;
  meta: string;
  amount: number;
}

const KIND_LABEL: Record<TrashKind, string> = {
  expense: "Gasto",
  investment: "Inversión",
  customer: "Cliente",
  product: "Producto",
  sale: "Venta",
};

export default function TrashPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  useEffect(() => {
    const expObs = liveQuery(() => db.expenses.where({ deleted: true }).reverse().sortBy("updatedAt"));
    const invObs = liveQuery(() => db.investments.where({ deleted: true }).reverse().sortBy("updatedAt"));
    const custObs = liveQuery(() => db.customers.where({ deleted: true }).reverse().sortBy("updatedAt"));
    const prodObs = liveQuery(() => db.products.where({ deleted: true }).reverse().sortBy("updatedAt"));
    const saleObs = liveQuery(() => db.sales.where({ deleted: true }).reverse().sortBy("updatedAt"));
    const expSub = expObs.subscribe((data) => setExpenses(data));
    const invSub = invObs.subscribe((data) => setInvestments(data));
    const custSub = custObs.subscribe((data) => setCustomers(data));
    const prodSub = prodObs.subscribe((data) => setProducts(data));
    const saleSub = saleObs.subscribe((data) => setSales(data));
    return () => {
      expSub.unsubscribe();
      invSub.unsubscribe();
      custSub.unsubscribe();
      prodSub.unsubscribe();
      saleSub.unsubscribe();
    };
  }, []);

  const items: TrashItem[] = [
    ...expenses.map((e) => ({
      id: e.id,
      kind: "expense" as const,
      title: e.description,
      meta: `${e.code} • ${formatDate(e.date)}`,
      amount: e.amount,
    })),
    ...investments.map((i) => ({
      id: i.id,
      kind: "investment" as const,
      title: i.name,
      meta: `Inversión • ${formatDate(i.date)}`,
      amount: i.value,
    })),
    ...customers.map((c) => ({
      id: c.id,
      kind: "customer" as const,
      title: c.name,
      meta: `Cliente • ${c.phone || "sin teléfono"}`,
      amount: 0,
    })),
    ...products.map((p) => ({
      id: p.id,
      kind: "product" as const,
      title: p.name,
      meta: `Producto • ${p.code}`,
      amount: 0,
    })),
    ...sales.map((s) => ({
      id: s.id,
      kind: "sale" as const,
      title: s.code,
      meta: `Venta • ${formatDate(s.date)}`,
      amount: s.total,
    })),
  ].sort((a, b) => b.meta.localeCompare(a.meta));

  const handleRestore = async (item: TrashItem) => {
    if (item.kind === "expense") {
      await db.expenses.update(item.id, { deleted: false, syncStatus: "pending" });
    } else if (item.kind === "investment") {
      await db.investments.update(item.id, { deleted: false, syncStatus: "pending" });
    } else if (item.kind === "customer") {
      await db.customers.update(item.id, { deleted: false, syncStatus: "pending" });
    } else if (item.kind === "product") {
      await db.products.update(item.id, { deleted: false, syncStatus: "pending" });
    } else {
      await db.sales.update(item.id, { deleted: false, syncStatus: "pending" });
    }
    toast.success(`${KIND_LABEL[item.kind]} restaurado`);
  };

  const handlePermanentDelete = async (item: TrashItem) => {
    if (item.kind === "expense") {
      await db.expenses.delete(item.id);
    } else if (item.kind === "investment") {
      await db.investments.delete(item.id);
    } else if (item.kind === "customer") {
      await db.customers.delete(item.id);
    } else if (item.kind === "product") {
      await db.inventoryMovements.where("productId").equals(item.id).delete();
      await db.products.delete(item.id);
    } else {
      await db.saleDetails.where("saleId").equals(item.id).delete();
      await db.inventoryMovements.where("referenceId").equals(item.id).delete();
      await db.sales.delete(item.id);
    }
    toast.success("Eliminado permanentemente");
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <h1 className="text-xl font-bold">Papelera</h1>
      <p className="text-sm text-zinc-500">Los registros eliminados se pueden recuperar.</p>

      {items.length === 0 ? (
        <div className="text-center py-16">
          <Trash2 size={40} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-600">La papelera está vacía</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <motion.div key={`${item.kind}-${item.id}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="flex items-center justify-between rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-zinc-300 truncate">{item.title}</p>
                <p className="text-xs text-zinc-600">{item.meta}{item.amount > 0 ? ` • ${formatCurrency(item.amount)}` : ""}</p>
              </div>
              <div className="flex gap-1 ml-3">
                <button onClick={() => handleRestore(item)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-emerald-400" title="Restaurar">
                  <RotateCcw size={14} />
                </button>
                <button onClick={() => handlePermanentDelete(item)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400" title="Eliminar definitivamente">
                  <Trash2 size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
