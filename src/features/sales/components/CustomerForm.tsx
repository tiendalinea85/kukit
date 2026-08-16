"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { customerSchema, type CustomerFormData } from "../schemas/customerSchema";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface Props {
  onSubmit: (data: CustomerFormData) => Promise<void>;
  defaultValues?: CustomerFormData;
  loading?: boolean;
}

export function CustomerForm({ onSubmit, defaultValues, loading }: Props) {
  const { register, handleSubmit, formState: { errors } } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: defaultValues || { name: "", phone: "", address: "", notes: "" },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input label="Nombre" {...register("name")} error={errors.name?.message} placeholder="Ej: Mary" />
      <Input label="Teléfono" {...register("phone")} error={errors.phone?.message} placeholder="Ej: 987 654 321" />
      <Input label="Dirección" {...register("address")} error={errors.address?.message} placeholder="Opcional" />
      <Input label="Observaciones" {...register("notes")} error={errors.notes?.message} placeholder="Opcional" />

      <Button type="submit" loading={loading} className="w-full">
        {defaultValues ? "Actualizar" : "Guardar"} Cliente
      </Button>
    </form>
  );
}
