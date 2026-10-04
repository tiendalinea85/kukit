"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { categorySchema, type CategoryFormData } from "../schemas/categorySchema";
import { CATEGORY_COLORS, CATEGORY_ICONS, DEFAULT_CATEGORY_COLOR, DEFAULT_CATEGORY_ICON } from "../domain/categoryRules";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const colors = CATEGORY_COLORS;
const iconOptions = CATEGORY_ICONS;

interface Props {
  onSubmit: (data: CategoryFormData) => Promise<void>;
  defaultValues?: CategoryFormData;
  loading?: boolean;
  submitLabel?: string;
}

export function CategoryForm({ onSubmit, defaultValues, loading, submitLabel }: Props) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: defaultValues || { name: "", color: DEFAULT_CATEGORY_COLOR, icon: DEFAULT_CATEGORY_ICON },
  });

  const selectedColor = watch("color");
  const selectedIcon = watch("icon");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input label="Nombre" {...register("name")} error={errors.name?.message} placeholder="Ej: Alimentación" />

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-400">Color</label>
        <div className="flex flex-wrap gap-2">
          {colors.map((c) => (
            <button key={c} type="button" onClick={() => setValue("color", c)}
              className={`w-8 h-8 rounded-full transition-all ${selectedColor === c ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-110" : ""}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-400">Icono</label>
        <div className="flex flex-wrap gap-2">
          {iconOptions.map((ico) => (
            <button key={ico} type="button" onClick={() => setValue("icon", ico)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${
                selectedIcon === ico ? "bg-purple-600/30 ring-2 ring-purple-500" : "bg-zinc-800 hover:bg-zinc-700"
              }`}
            >
              {ico}
            </button>
          ))}
        </div>
      </div>

      <Button type="submit" loading={loading} className="w-full">
        {submitLabel ?? `${defaultValues ? "Actualizar" : "Crear"} Categoría`}
      </Button>
    </form>
  );
}
