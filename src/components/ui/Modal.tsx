"use client";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function Modal({ open, onClose, title, children }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {title && (
              <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
                <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400">
                  <X size={20} />
                </button>
              </div>
            )}
            <div className="p-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
