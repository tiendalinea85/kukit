"use client";
import { formatCurrency } from "@/utils/format";

interface Props {
  total: number;
  itemsCount?: number;
  hasDetails?: boolean;
}

export function ExpenseSummaryCard({ total, itemsCount, hasDetails }: Props) {
  return (
    <div className="rounded-xl bg-gradient-to-br from-purple-600/10 to-pink-600/5 border border-purple-600/20 p-4 space-y-1">
      <p className="text-xs text-zinc-500">Total General</p>
      <p className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
        {formatCurrency(total)}
      </p>
      {hasDetails && itemsCount !== undefined && (
        <p className="text-xs text-zinc-500">{itemsCount} concepto(s)</p>
      )}
    </div>
  );
}
