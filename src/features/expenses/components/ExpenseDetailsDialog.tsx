"use client";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { formatCurrency } from "@/utils/format";
import type { ExpenseDetail } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  details: ExpenseDetail[];
  expenseName: string;
}

export function ExpenseDetailsDialog({ open, onClose, details, expenseName }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-[10%] z-50 max-w-lg mx-auto"
          >
            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                <div>
                  <h3 className="font-semibold text-zinc-100">Detalle de Gastos</h3>
                  <p className="text-xs text-zinc-500">{expenseName}</p>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400">
                  <X size={18} />
                </button>
              </div>
              <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
                {details.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-4">Sin conceptos registrados</p>
                ) : (
                  <div className="space-y-2">
                    {details.map((d, i) => (
                      <div
                        key={d.id || i}
                        className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/40 border border-zinc-700/30"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-200 truncate">{d.productName}</p>
                          <p className="text-xs text-zinc-500">
                            {d.quantity} x {formatCurrency(d.unitPrice)}
                          </p>
                        </div>
                        <p className="text-sm font-mono text-zinc-100 ml-3">{formatCurrency(d.subtotal)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {details.length > 0 && (
                <div className="p-4 border-t border-zinc-800 bg-zinc-800/20">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400">Total</span>
                    <span className="text-lg font-bold text-purple-400">
                      {formatCurrency(details.reduce((s, d) => s + d.subtotal, 0))}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
