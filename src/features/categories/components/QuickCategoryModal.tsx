"use client";
import { useState } from "react";
import toast from "react-hot-toast";
import { Modal } from "@/components/ui/Modal";
import { CategoryForm } from "./CategoryForm";
import { createCategory } from "../services/categoryService";
import { DEFAULT_CATEGORY_COLOR, DEFAULT_CATEGORY_ICON } from "../domain/categoryRules";
import type { CategoryFormData } from "../schemas/categorySchema";
import type { Category } from "@/types";

// Alta de categoría desde el propio formulario (gasto, inversión, producto o
// prenda): no obliga a salir del formulario ni a perder lo ya capturado. La
// categoría creada se devuelve para seleccionarla en el `Select` de origen.

interface Props {
  open: boolean;
  onClose: () => void;
  /** Opcional: solo la usan los formularios que deben seleccionar lo creado. */
  onCreated?: (category: Category) => void;
  /** Nombre escrito por el usuario en un filtro, para precargar. */
  defaultName?: string;
}

export function QuickCategoryModal({ open, onClose, onCreated, defaultName = "" }: Props) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data: CategoryFormData) => {
    setLoading(true);
    try {
      const category = await createCategory(data);
      toast.success("Categoría creada");
      onCreated?.(category);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear la categoría");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nueva Categoría">
      <CategoryForm
        onSubmit={handleSubmit}
        defaultValues={{ name: defaultName, color: DEFAULT_CATEGORY_COLOR, icon: DEFAULT_CATEGORY_ICON }}
        submitLabel="Crear Categoría"
        loading={loading}
      />
    </Modal>
  );
}
