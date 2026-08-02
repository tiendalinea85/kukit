import { db } from "./db";
import type { Expense, ExpenseDetail } from "@/types";

const defaultCategories = [
  { name: "Alimentación", color: "#ef4444", icon: "🛒" },
  { name: "Transporte", color: "#f97316", icon: "🚗" },
  { name: "Servicios", color: "#eab308", icon: "💡" },
  { name: "Salud", color: "#22c55e", icon: "🏥" },
  { name: "Educación", color: "#06b6d4", icon: "📚" },
  { name: "Ropa", color: "#3b82f6", icon: "🛍️" },
  { name: "Entretenimiento", color: "#8b5cf6", icon: "🎯" },
  { name: "Vivienda", color: "#ec4899", icon: "🏠" },
  { name: "Otros", color: "#78716c", icon: "📦" },
];

const defaultTypes = [
  "Fijo",
  "Variable",
  "Suscripción",
  "Emergencia",
  "Ahorro",
];

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

export async function seedIfEmpty() {
  const catCount = await db.categories.count();
  let catIds: string[] = [];

  if (catCount === 0) {
    const categories = defaultCategories.map((c) => ({
      id: crypto.randomUUID(),
      ...c,
      createdAt: new Date().toISOString(),
      syncStatus: "local" as const,
    }));
    await db.categories.bulkAdd(categories);
    catIds = categories.map((c) => c.id);
  } else {
    const cats = await db.categories.toArray();
    catIds = cats.map((c) => c.id);
  }

  const typeCount = await db.types.count();
  let typeIds: string[] = [];

  if (typeCount === 0) {
    const types = defaultTypes.map((t) => ({
      id: crypto.randomUUID(),
      name: t,
      createdAt: new Date().toISOString(),
      syncStatus: "local" as const,
    }));
    await db.types.bulkAdd(types);
    typeIds = types.map((t) => t.id);
  } else {
    const types = await db.types.toArray();
    typeIds = types.map((t) => t.id);
  }

  const expenseCount = await db.expenses.count();
  if (expenseCount === 0 && catIds.length > 0 && typeIds.length > 0) {
    const now = new Date().toISOString();
    const sampleExpenses: Expense[] = [
      { id: crypto.randomUUID(), code: "G000001", name: "Compra semanal en supermercado", description: "Víveres para la semana", amount: 185.50, categoryId: catIds[0], typeId: typeIds[1], paymentMethod: "tarjeta_debito", status: "pagado", date: daysAgo(1), time: "10:30", notes: "", createdAt: now, updatedAt: now, deleted: false, syncStatus: "local", hasDetails: false, totalAmount: 185.50, itemsCount: 0 },
      { id: crypto.randomUUID(), code: "G000002", name: "Pasaje de bus", description: "Pasaje ida y vuelta", amount: 7.00, categoryId: catIds[1], typeId: typeIds[1], paymentMethod: "efectivo", status: "pagado", date: daysAgo(1), time: "07:45", notes: "", createdAt: now, updatedAt: now, deleted: false, syncStatus: "local", hasDetails: false, totalAmount: 7.00, itemsCount: 0 },
      { id: crypto.randomUUID(), code: "G000003", name: "Recibo de luz", description: "", amount: 98.30, categoryId: catIds[2], typeId: typeIds[0], paymentMethod: "transferencia", status: "pagado", date: daysAgo(3), time: "14:00", notes: "", createdAt: now, updatedAt: now, deleted: false, syncStatus: "local", hasDetails: false, totalAmount: 98.30, itemsCount: 0 },
      { id: crypto.randomUUID(), code: "G000004", name: "Consulta médica", description: "Consulta general", amount: 60.00, categoryId: catIds[3], typeId: typeIds[3], paymentMethod: "efectivo", status: "pagado", date: daysAgo(4), time: "09:15", notes: "", createdAt: now, updatedAt: now, deleted: false, syncStatus: "local", hasDetails: false, totalAmount: 60.00, itemsCount: 0 },
      { id: crypto.randomUUID(), code: "G000005", name: "Curso online", description: "Curso de JavaScript", amount: 250.00, categoryId: catIds[4], typeId: typeIds[2], paymentMethod: "yape", status: "pagado", date: daysAgo(5), time: "11:20", notes: "Suscripción mensual", createdAt: now, updatedAt: now, deleted: false, syncStatus: "local", hasDetails: false, totalAmount: 250.00, itemsCount: 0 },
      { id: crypto.randomUUID(), code: "G000006", name: "Chaqueta", description: "Chaqueta impermeable", amount: 129.90, categoryId: catIds[5], typeId: typeIds[1], paymentMethod: "tarjeta_credito", status: "activo", date: daysAgo(6), time: "16:40", notes: "", createdAt: now, updatedAt: now, deleted: false, syncStatus: "local", hasDetails: false, totalAmount: 129.90, itemsCount: 0 },
      { id: crypto.randomUUID(), code: "G000007", name: "Netflix", description: "Plan estándar", amount: 29.90, categoryId: catIds[6], typeId: typeIds[2], paymentMethod: "tarjeta_debito", status: "pendiente", date: daysAgo(7), time: "00:00", notes: "", createdAt: now, updatedAt: now, deleted: false, syncStatus: "local", hasDetails: false, totalAmount: 29.90, itemsCount: 0 },
      { id: crypto.randomUUID(), code: "G000008", name: "Alquiler departamento", description: "", amount: 850.00, categoryId: catIds[7], typeId: typeIds[0], paymentMethod: "transferencia", status: "pagado", date: daysAgo(2), time: "10:00", notes: "Mes actual", createdAt: now, updatedAt: now, deleted: false, syncStatus: "local", hasDetails: false, totalAmount: 850.00, itemsCount: 0 },
      { id: crypto.randomUUID(), code: "G000009", name: "Gasolina", description: "Tanque lleno", amount: 45.00, categoryId: catIds[1], typeId: typeIds[1], paymentMethod: "efectivo", status: "pagado", date: daysAgo(2), time: "18:30", notes: "", createdAt: now, updatedAt: now, deleted: false, syncStatus: "local", hasDetails: false, totalAmount: 45.00, itemsCount: 0 },
      { id: crypto.randomUUID(), code: "G000010", name: "Cena con amigos", description: "Restaurante", amount: 75.00, categoryId: catIds[0], typeId: typeIds[1], paymentMethod: "yape", status: "pagado", date: daysAgo(0), time: "20:15", notes: "", createdAt: now, updatedAt: now, deleted: false, syncStatus: "local", hasDetails: false, totalAmount: 75.00, itemsCount: 0 },
    ];

    const detailedExpenseId = crypto.randomUUID();
    const detailedExpense: Expense = {
      id: detailedExpenseId,
      code: "G000011",
      name: "Fumigación de cultivos",
      description: "Productos para fumigación de la semana",
      amount: 25.00,
      categoryId: catIds[0],
      typeId: typeIds[1],
      paymentMethod: "efectivo",
      status: "pagado",
      date: daysAgo(0),
      time: "08:00",
      notes: "Aplicar con cuidado",
      createdAt: now,
      updatedAt: now,
      deleted: false,
      syncStatus: "local",
      hasDetails: true,
      totalAmount: 25.00,
      itemsCount: 3,
    };
    sampleExpenses.push(detailedExpense);

    await db.expenses.bulkAdd(sampleExpenses);

    const sampleDetails: ExpenseDetail[] = [
      {
        id: crypto.randomUUID(),
        expenseId: detailedExpenseId,
        productName: "Esfire",
        quantity: 2,
        unitPrice: 5,
        subtotal: 10,
        createdAt: now,
        syncStatus: "local",
      },
      {
        id: crypto.randomUUID(),
        expenseId: detailedExpenseId,
        productName: "Captan",
        quantity: 1,
        unitPrice: 10,
        subtotal: 10,
        createdAt: now,
        syncStatus: "local",
      },
      {
        id: crypto.randomUUID(),
        expenseId: detailedExpenseId,
        productName: "Raizador",
        quantity: 1,
        unitPrice: 5,
        subtotal: 5,
        createdAt: now,
        syncStatus: "local",
      },
    ];
    await db.expenseDetails.bulkAdd(sampleDetails);
  }
}
