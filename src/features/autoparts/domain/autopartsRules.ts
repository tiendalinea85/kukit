import type {
  VehicleBrand,
  VehicleModel,
  AutoPart,
  PartCompatibility,
  PartCategory,
} from "@/types/modules";

export const PART_CATEGORIES: { value: PartCategory; label: string }[] = [
  { value: "motor", label: "Motor" },
  { value: "frenos", label: "Frenos" },
  { value: "suspension", label: "Suspensión" },
  { value: "electrico", label: "Eléctrico" },
  { value: "transmision", label: "Transmisión" },
  { value: "carroceria", label: "Carrocería" },
  { value: "filtro", label: "Filtro" },
  { value: "aceite", label: "Aceite" },
  { value: "otro", label: "Otro" },
];

export function buildVehicleBrand(input: {
  data: { name: string; country: string };
  now: string;
}): VehicleBrand {
  return {
    id: crypto.randomUUID(),
    name: input.data.name.trim(),
    country: input.data.country.trim(),
    createdAt: input.now,
    updatedAt: input.now,
    deleted: false,
    syncStatus: "pending",
    workspaceId: "",
  };
}

export function buildVehicleModel(input: {
  data: {
    brandId: string;
    brandName: string;
    name: string;
    startYear: number;
    endYear: number | null;
    engine: string;
    notes: string;
  };
  now: string;
}): VehicleModel {
  return {
    id: crypto.randomUUID(),
    brandId: input.data.brandId,
    brandName: input.data.brandName.trim(),
    name: input.data.name.trim(),
    startYear: input.data.startYear,
    endYear: input.data.endYear,
    engine: input.data.engine.trim(),
    notes: input.data.notes || "",
    createdAt: input.now,
    deleted: false,
    syncStatus: "pending",
    workspaceId: "",
  };
}

export function buildAutoPart(input: {
  data: {
    name: string;
    partNumber: string;
    brand: string;
    category: PartCategory;
    unitPrice: number;
    costPrice: number;
    stock: number;
    minStock: number;
    notes: string;
  };
  code: string;
  now: string;
}): AutoPart {
  return {
    id: crypto.randomUUID(),
    code: input.code,
    name: input.data.name.trim(),
    partNumber: input.data.partNumber.trim(),
    brand: input.data.brand.trim(),
    category: input.data.category,
    unitPrice: input.data.unitPrice,
    costPrice: input.data.costPrice,
    stock: input.data.stock,
    minStock: input.data.minStock,
    notes: input.data.notes || "",
    createdAt: input.now,
    updatedAt: input.now,
    deleted: false,
    syncStatus: "pending",
    workspaceId: "",
  };
}

export function buildPartCompatibility(input: {
  data: {
    partId: string;
    modelId: string;
    brandName: string;
    modelName: string;
    yearFrom: number;
    yearTo: number | null;
    engine: string;
    notes: string;
  };
  now: string;
}): PartCompatibility {
  return {
    id: crypto.randomUUID(),
    partId: input.data.partId,
    modelId: input.data.modelId,
    brandName: input.data.brandName.trim(),
    modelName: input.data.modelName.trim(),
    yearFrom: input.data.yearFrom,
    yearTo: input.data.yearTo,
    engine: input.data.engine.trim(),
    notes: input.data.notes || "",
    createdAt: input.now,
    deleted: false,
    syncStatus: "pending",
    workspaceId: "",
  };
}

export function canEditAutoPart(_part: Pick<AutoPart, "deleted">): boolean {
  return !_part.deleted;
}

export interface FilterableAutoPart {
  id: string;
  code: string;
  name: string;
  partNumber: string;
  brand: string;
  category: string;
  stock: number;
  deleted?: boolean;
}

export interface AutoPartFilters {
  search?: string;
  category?: string;
}

export function filterAutoParts<T extends FilterableAutoPart>(
  parts: T[],
  filters: AutoPartFilters = {}
): T[] {
  const search = (filters.search || "").trim().toLowerCase();

  return parts.filter((part) => {
    if (part.deleted === true) return false;
    if (filters.category && part.category !== filters.category) return false;

    if (search) {
      const haystack = [
        part.code,
        part.name,
        part.partNumber,
        part.brand,
        part.category,
        String(part.stock),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });
}
