"use client";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Trash2 } from "lucide-react";
import { categorySchema, type CategoryFormData } from "../schemas/categorySchema";
import {
  CATEGORY_COLORS,
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ICON,
  filterCategoryIconGroups,
} from "../domain/categoryRules";
import { iconText, isDataUrlIcon } from "../domain/customIconRules";
import {
  deleteCustomIcon,
  fileToIconDataUrl,
} from "../services/customIconService";
import { useCustomIcons } from "../hooks/useCustomIcons";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import toast from "react-hot-toast";

const colors = CATEGORY_COLORS;

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
  const { icons: customIcons } = useCustomIcons();
  const [iconQuery, setIconQuery] = useState("");
  const imageInput = useRef<HTMLInputElement>(null);

  const groups = filterCategoryIconGroups(iconQuery);
  const isCustom = isDataUrlIcon(selectedIcon);

  const handleImage = async (file: File | undefined) => {
    if (!file) return;
    try {
      setValue("icon", await fileToIconDataUrl(file));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo leer la imagen");
    } finally {
      if (imageInput.current) imageInput.current.value = "";
    }
  };

  const handleRemoveIcon = async (id: string, name: string, dataUrl: string) => {
    if (!confirm(`¿Quitar el icono "${name}" del set?`)) return;
    try {
      await deleteCustomIcon(id);
      if (selectedIcon === dataUrl) setValue("icon", DEFAULT_CATEGORY_ICON);
      toast.success("Icono eliminado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar el icono");
    }
  };

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

        {isCustom ? (
          <div className="flex items-center gap-3 rounded-xl bg-zinc-800/60 p-3">
            <CategoryIcon icon={selectedIcon} className="text-2xl" />
            <span className="text-sm text-zinc-300">Imagen personalizada</span>
            <button type="button" onClick={() => setValue("icon", DEFAULT_CATEGORY_ICON)}
              className="ml-auto text-xs text-zinc-500 hover:text-zinc-200">
              Quitar
            </button>
          </div>
        ) : null}

        <input ref={imageInput} type="file" accept="image/*" className="hidden"
          onChange={(e) => void handleImage(e.target.files?.[0])} />
        <Button type="button" size="sm" variant="secondary" onClick={() => imageInput.current?.click()}>
          <ImagePlus size={16} /> Subir imagen
        </Button>

        {customIcons.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-zinc-500">Tu set</p>
            <div className="flex flex-wrap gap-2">
              {customIcons.map((icon) => (
                <span key={icon.id} className="group relative">
                  <button type="button" onClick={() => setValue("icon", icon.dataUrl)}
                    title={icon.name}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center p-1 transition-all ${
                      selectedIcon === icon.dataUrl ? "bg-purple-600/30 ring-2 ring-purple-500" : "bg-zinc-800 hover:bg-zinc-700"
                    }`}
                  >
                    <CategoryIcon icon={icon.dataUrl} className="text-xl" />
                  </button>
                  <button type="button" onClick={() => void handleRemoveIcon(icon.id, icon.name, icon.dataUrl)}
                    aria-label={`Eliminar ${icon.name}`}
                    className="absolute -top-1 -right-1 hidden rounded-full bg-zinc-900 p-0.5 text-zinc-500 hover:text-red-400 group-hover:block"
                  >
                    <Trash2 size={10} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <Input placeholder="Buscar iconos (taller, gasolina, rpc)" value={iconQuery} onChange={(e) => setIconQuery(e.target.value)} />

        <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="text-xs text-zinc-600 mb-1">{group.label}</p>
              <div className="flex flex-wrap gap-2">
                {group.icons.map((ico) => (
                  <button key={ico} type="button" onClick={() => setValue("icon", ico)} title={group.label}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${
                      selectedIcon === ico ? "bg-purple-600/30 ring-2 ring-purple-500" : "bg-zinc-800 hover:bg-zinc-700"
                    }`}
                  >
                    {ico}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {groups.length === 0 && (
            <p className="text-sm text-zinc-600 py-2 text-center">Sin iconos para «{iconQuery}»</p>
          )}
        </div>

        {errors.icon && <p className="text-xs text-red-400">{errors.icon.message}</p>}
        <p className="text-xs text-zinc-600">
          Icono en uso: {iconText(selectedIcon)}
        </p>
      </div>

      <Button type="submit" loading={loading} className="w-full">
        {submitLabel ?? `${defaultValues ? "Actualizar" : "Crear"} Categoría`}
      </Button>
    </form>
  );
}