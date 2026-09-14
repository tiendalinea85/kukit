"use client";
import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, error, className = "", type = "text", ...props }, ref) => {
    const [show, setShow] = useState(false);
    const isPassword = type === "password";

    return (
      <div className="space-y-1.5">
        {label && <label className="text-sm font-medium text-zinc-400">{label}</label>}
        <div className="relative">
          <input
            ref={ref}
            type={isPassword && show ? "text" : type}
            className={`w-full rounded-xl bg-zinc-800/60 border border-zinc-700/50 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 outline-none transition-all focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 ${isPassword ? "pr-10" : ""} ${className}`}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              tabIndex={-1}
              aria-label={show ? "Ocultar contraseña" : "Ver contraseña"}
              onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";