"use client";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { CustomerForm } from "@/features/sales/components/CustomerForm";
import { createCustomer, updateCustomer, deleteCustomer } from "@/features/sales/services/customerService";
import { useCustomers } from "@/features/sales/hooks/useCustomers";
import toast from "react-hot-toast";
import type { CustomerFormData } from "@/features/sales/schemas/customerSchema";
import type { Customer } from "@/types";

const PAGE_SIZE = 25;

export default function CustomersPage() {
  const { customers } = useCustomers();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return customers.slice(start, start + PAGE_SIZE);
  }, [customers, page]);

  const handleSubmit = async (data: CustomerFormData) => {
    setLoading(true);
    try {
      if (editing) {
        await updateCustomer(editing.id, data);
        toast.success("Cliente actualizado");
      } else {
        await createCustomer(data);
        toast.success("Cliente creado");
      }
      setModalOpen(false);
      setEditing(null);
    } catch {
      toast.error("Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (c: Customer) => {
    await deleteCustomer(c.id);
    toast.success("Cliente enviado a la papelera");
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Clientes</h1>
        <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus size={16} /> Nuevo
        </Button>
      </div>

      <div className="space-y-2">
        {paged.map((c, i) => (
          <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            className="flex items-center justify-between rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-4"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-600/15 text-purple-400 shrink-0">
                <Users size={18} />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-zinc-200 truncate">{c.name}</p>
                <p className="text-xs text-zinc-600 truncate">
                  {[c.phone, c.address].filter(Boolean).join(" · ") || "Sin contacto"}
                </p>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => { setEditing(c); setModalOpen(true); }} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300">
                <Pencil size={14} />
              </button>
              <button onClick={() => handleDelete(c)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400">
                <Trash2 size={14} />
              </button>
            </div>
          </motion.div>
        ))}
        {customers.length === 0 && (
          <div className="text-center py-16">
            <Users size={40} className="mx-auto text-zinc-700 mb-3" />
            <p className="text-zinc-600 text-lg">No hay clientes registrados</p>
            <p className="text-zinc-700 text-sm mt-1">Crea tu primer cliente para registrar ventas.</p>
          </div>
        )}
      </div>
      <Pagination page={page} totalItems={customers.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} title={editing ? "Editar Cliente" : "Nuevo Cliente"}>
        <CustomerForm
          onSubmit={handleSubmit}
          defaultValues={editing ? { name: editing.name, phone: editing.phone, address: editing.address, notes: editing.notes } : undefined}
          loading={loading}
        />
      </Modal>
    </motion.div>
  );
}
