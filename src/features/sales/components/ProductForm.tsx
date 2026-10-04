"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productWithStockSchema, type ProductWithStockFormData } from "../schemas/productSchema";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { QuickCategoryModal } from "@/features/categories/components/QuickCategoryModal";
import type { Category } from "@/types";

interface Props {
  onSubmit: (data: ProductWithStockFormData) => Promise<void>;
  defaultValues?: ProductWithStockFormData;
  loading?: boolean;
  categories?: Category[];
}

export function ProductForm({ onSubmit, defaultValues, loading, categories = [] }: Props) {
  const [categoryModal, setCategoryModal] = useState(false);
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<ProductWithStockFormData>({
    resolver: zodResolver(productWithStockSchema),
    defaultValues: defaultValues || { code: "", name: "", color: "", categoryId: "", initialStock: 0 },
  });

  return (
    <>
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input label="Código" {...register("code")} error={errors.code?.message} placeholder="Ej: LEG-001" />
      <Input label="Nombre" {...register("name")} error={errors.name?.message} placeholder="Ej: Leggings" />
      <Input label="Color" {...register("color")} error={errors.color?.message} placeholder="Ej: Negro" />
      <Select
        label="Categoría"
        {...register("categoryId")}
        error={errors.categoryId?.message}
        placeholder="Sin categoría"
        options={categories.map((c) => ({ value: c.id, label: c.name }))}
        onNew={() => setCategoryModal(true)}
        newLabel="Nueva categoría"
      />
      {!defaultValues && (
        <Input
          label="Stock inicial"
          type="number"
          step="any"
          {...register("initialStock")}
          error={errors.initialStock?.message}
          placeholder="Ej: 50"
        />
      )}

      <Button type="submit" loading={loading} className="w-full">
        {defaultValues ? "Actualizar" : "Crear"} Producto
      </Button>
    </form>

    {/* Fuera del `<form>`: un formulario no puede anidar otro. */}
    <QuickCategoryModal
      open={categoryModal}
      onClose={() => setCategoryModal(false)}
      onCreated={(category) => setValue("categoryId", category.id, { shouldValidate: true })}
    />
    </>
  );
}
