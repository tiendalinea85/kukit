"use client";
import { motion, type HTMLMotionProps } from "framer-motion";

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading,
  className = "",
  ...props
}: Props) {
  const base = "rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50";
  const variants: Record<string, string> = {
    primary: "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/25",
    secondary: "bg-zinc-800 hover:bg-zinc-700 text-zinc-100",
    ghost: "bg-transparent hover:bg-zinc-800/50 text-zinc-300",
    danger: "bg-red-600 hover:bg-red-500 text-white",
  };
  const sizes: Record<string, string> = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2.5 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...(props as unknown as HTMLMotionProps<"button">)}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </motion.button>
  );
}
