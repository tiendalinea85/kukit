"use client";
import { forwardRef } from "react";

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, error, className = "", ...props }, ref) => (
    <div className="space-y-1.5">
      {label && <label className="text-sm font-medium text-zinc-400">{label}</label>}
      <input
        ref={ref}
        className={`w-full rounded-xl bg-zinc-800/60 border border-zinc-700/50 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 outline-none transition-all focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
);
Input.displayName = "Input";
