"use client";
import { Plus } from "lucide-react";
import { ExpenseItemRow } from "./ExpenseItemRow";
import { Button } from "@/components/ui/Button";

interface DetailItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface Props {
  items: DetailItem[];
  onUpdate: (index: number, field: keyof DetailItem, value: string | number) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  error?: string;
}

export function ExpenseItemsTable({ items, onUpdate, onRemove, onAdd, error }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-zinc-400">Detalle del gasto</label>
        <Button type="button" variant="ghost" size="sm" onClick={onAdd}>
          <Plus size={14} /> Agregar Concepto
        </Button>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <ExpenseItemRow
            key={item.id}
            index={index}
            item={item}
            onUpdate={onUpdate}
            onRemove={onRemove}
          />
        ))}
      </div>
      {items.length === 0 && (
        <p className="text-sm text-zinc-500 text-center py-4 bg-zinc-800/30 rounded-xl border border-dashed border-zinc-700/50">
          Agregue al menos un concepto
        </p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
