"use client";
import { useState } from "react";
import toast from "react-hot-toast";
import { Modal } from "@/components/ui/Modal";
import { CustomerForm } from "./CustomerForm";
import { createCustomer } from "../services/customerService";
import type { CustomerFormData } from "../schemas/customerSchema";
import type { Customer } from "@/types";

// Alta de cliente desde la propia venta: no obliga a salir del formulario ni a
// perder las líneas ya capturadas. El cliente creado se devuelve para
// seleccionarlo en el `Select` de origen.

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (customer: Customer) => void;
}

export function QuickCustomerModal({ open, onClose, onCreated }: Props) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data: CustomerFormData) => {
    setLoading(true);
    try {
      const customer = await createCustomer(data);
      toast.success("Cliente creado");
      onCreated?.(customer);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear el cliente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo Cliente">
      <CustomerForm onSubmit={handleSubmit} loading={loading} />
    </Modal>
  );
}
