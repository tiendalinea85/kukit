"use client";
import { forwardRef } from "react";

interface Props extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, Props>(
  ({ label, error, options, placeholder, className = "", ...props }, ref) => (
    <div className="space-y-1.5">
      {label && <label className="text-sm font-medium text-zinc-400">{label}</label>}
      <select
        ref={ref}
        className={`w-full rounded-xl bg-zinc-800/60 border border-zinc-700/50 px-4 py-2.5 text-zinc-100 outline-none transition-all focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 ${className}`}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
);
Select.displayName = "Select";
