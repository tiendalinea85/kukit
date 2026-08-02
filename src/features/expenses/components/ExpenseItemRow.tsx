"use client";
import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/Input";

interface DetailItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface Props {
  index: number;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: keyof DetailItem, value: string | number) => void;
  item: DetailItem;
}

export function ExpenseItemRow({ index, onRemove, onUpdate, item }: Props) {
  return (
    <div className="grid grid-cols-12 gap-2 items-end">
      <div className="col-span-4">
        <Input
          label={index === 0 ? "Concepto" : undefined}
          placeholder="Producto o servicio"
          value={item.productName}
          onChange={(e) => onUpdate(index, "productName", e.target.value)}
        />
      </div>
      <div className="col-span-2">
        <Input
          label={index === 0 ? "Cant." : undefined}
          type="number"
          step="0.01"
          min="0"
          placeholder="0"
          value={item.quantity || ""}
          onChange={(e) => onUpdate(index, "quantity", e.target.value)}
        />
      </div>
      <div className="col-span-3">
        <Input
          label={index === 0 ? "Precio" : undefined}
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={item.unitPrice || ""}
          onChange={(e) => onUpdate(index, "unitPrice", e.target.value)}
        />
      </div>
      <div className="col-span-2">
        <div className="space-y-1.5">
          {index === 0 && <label className="text-sm font-medium text-zinc-400">Subtotal</label>}
          <div className="h-[42px] flex items-center text-sm text-zinc-300 font-mono">
            {item.subtotal.toFixed(2)}
          </div>
        </div>
      </div>
      <div className="col-span-1 flex justify-center">
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="p-2 rounded-lg hover:bg-red-600/20 text-zinc-500 hover:text-red-400 transition-colors"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
