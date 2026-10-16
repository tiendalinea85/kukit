"use client";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productWithStockSchema, type ProductWithStockFormData } from "../schemas/productSchema";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { QuickCategoryModal } from "@/features/categories/components/QuickCategoryModal";
import { generateProductCode } from "@/utils/code";
import type { Category } from "@/types";

interface Props {
  onSubmit: (data: ProductWithStockFormData) => Promise<void>;
  defaultValues?: ProductWithStockFormData;
  loading?: boolean;
  categories?: Category[];
}

export function ProductForm({ onSubmit, defaultValues, loading, categories = [] }: Props) {
  const [categoryModal, setCategoryModal] = useState(false);
  const isEditing = !!defaultValues;
  // Si el usuario edita el código a mano, se deja de auto-generarlo.
  const codeTouchedRef = useRef(isEditing);
  const codeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<ProductWithStockFormData>({
    resolver: zodResolver(productWithStockSchema),
    defaultValues: defaultValues || { code: "", name: "", color: "", categoryId: "", initialStock: 0 },
  });

  const nameValue = watch("name");

  // Código correlativo automático a partir del nombre ("Rollo de tela" → ROT-001),
  // igual que en el formulario de gastos. Solo en creación y sin tocar el código.
  useEffect(() => {
    if (isEditing || codeTouchedRef.current) return;
    if (codeTimerRef.current) clearTimeout(codeTimerRef.current);
    const name = (nameValue ?? "").trim();
    if (!name) {
      setValue("code", "");
      return;
    }
    codeTimerRef.current = setTimeout(() => {
      void (async () => {
        const code = await generateProductCode(name);
        if (!codeTouchedRef.current) {
          setValue("code", code, { shouldValidate: true });
        }
      })();
    }, 400);
    return () => {
      if (codeTimerRef.current) clearTimeout(codeTimerRef.current);
    };
  }, [nameValue, isEditing, setValue]);

  return (
    <>
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="Código"
        {...register("code", {
          onChange: () => { codeTouchedRef.current = true; },
        })}
        error={errors.code?.message}
        placeholder={isEditing ? "Ej: LEG-001" : "Se genera automáticamente"}
      />
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
      {!isEditing && (
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
        {isEditing ? "Actualizar" : "Crear"} Producto
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
