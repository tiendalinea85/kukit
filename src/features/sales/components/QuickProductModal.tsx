"use client";
import { useState } from "react";
import toast from "react-hot-toast";
import { Modal } from "@/components/ui/Modal";
import { ProductForm } from "./ProductForm";
import { createProduct } from "../services/productService";
import { useCategories } from "@/features/categories/hooks/useCategories";
import type { ProductWithStockFormData } from "../schemas/productSchema";
import type { Product } from "@/types";

// Alta de producto desde la propia venta. El stock inicial se registra como
// movimiento de entrada, igual que en la pantalla de productos.

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (product: Product) => void;
}

export function QuickProductModal({ open, onClose, onCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const { categories } = useCategories();

  const handleSubmit = async (data: ProductWithStockFormData) => {
    setLoading(true);
    try {
      const product = await createProduct(data);
      toast.success("Producto creado");
      onCreated?.(product);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear el producto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo Producto">
      <ProductForm onSubmit={handleSubmit} categories={categories} loading={loading} />
    </Modal>
  );
}
