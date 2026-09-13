import { db } from "./db";
import type { Expense, Investment } from "@/types";
import { INVESTMENT_CATEGORY_DEFAULTS } from "@/features/investments/domain/investmentRules";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

const defaultCategories = [
  { name: "Servicios", color: "#eab308", icon: "💡" },
  { name: "Transporte", color: "#f97316", icon: "🚗" },
  { name: "Publicidad", color: "#06b6d4", icon: "📢" },
  { name: "Arriendo", color: "#3b82f6", icon: "🏢" },
  { name: "Mantenimiento", color: "#22c55e", icon: "🛠️" },
  { name: "Sueldos", color: "#8b5cf6", icon: "👤" },
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

/**
 * Siembra la base de un workspace (categorías, tipos e categorías de
 * inversión) y, opcionalmente, datos de ejemplo. Todo queda aislado por
 * workspaceId: cada workspace solo ve sus propios registros.
 */
export async function seedForWorkspace(workspaceId: string, withSamples = false) {
  const catCount = await db.categories.where("workspaceId").equals(workspaceId).count();
  let catIds: string[] = [];

  if (catCount === 0) {
    const categories = defaultCategories.map((c) => ({
      id: crypto.randomUUID(),
      workspaceId,
      ...c,
      createdAt: new Date().toISOString(),
      syncStatus: "local" as const,
    }));
    await db.categories.bulkAdd(categories);
    catIds = categories.map((c) => c.id);
  } else {
    const cats = await db.categories.where("workspaceId").equals(workspaceId).toArray();
    catIds = cats.map((c) => c.id);
  }

  const typeCount = await db.types.where("workspaceId").equals(workspaceId).count();

  if (typeCount === 0) {
    const types = defaultTypes.map((t) => ({
      id: crypto.randomUUID(),
      workspaceId,
      name: t,
      createdAt: new Date().toISOString(),
      syncStatus: "local" as const,
    }));
    await db.types.bulkAdd(types);
  }

  const invCatCount = await db.investmentCategories.where("workspaceId").equals(workspaceId).count();
  let invCatIds: string[] = [];

  if (invCatCount === 0) {
    const invCats = INVESTMENT_CATEGORY_DEFAULTS.map((c) => ({
      id: crypto.randomUUID(),
      workspaceId,
      ...c,
      createdAt: new Date().toISOString(),
      syncStatus: "local" as const,
    }));
    await db.investmentCategories.bulkAdd(invCats);
    invCatIds = invCats.map((c) => c.id);
  } else {
    const invCats = await db.investmentCategories.where("workspaceId").equals(workspaceId).toArray();
    invCatIds = invCats.map((c) => c.id);
  }

  if (!withSamples) return;

  const expenseCount = await db.expenses.where("workspaceId").equals(workspaceId).count();
  if (expenseCount === 0 && catIds.length > 0) {
    const now = new Date().toISOString();
    const [servicios, transporte, publicidad, arriendo, mantenimiento, sueldos, otros] = catIds;

    const sampleExpenses: Expense[] = [
      { id: crypto.randomUUID(), workspaceId, code: "G000001", description: "Recibo de energía eléctrica", amount: 98.30, categoryId: servicios, paymentMethod: "transferencia", status: "pagado", date: daysAgo(1), time: "14:00", notes: "Período mensual", voidedAt: null, createdAt: now, updatedAt: now, deleted: false, syncStatus: "local" },
      { id: crypto.randomUUID(), workspaceId, code: "G000002", description: "Combustible de la camioneta de reparto", amount: 45.00, categoryId: transporte, paymentMethod: "efectivo", status: "pagado", date: daysAgo(1), time: "18:30", notes: "", voidedAt: null, createdAt: now, updatedAt: now, deleted: false, syncStatus: "local" },
      { id: crypto.randomUUID(), workspaceId, code: "G000003", description: "Campaña en redes sociales", amount: 250.00, categoryId: publicidad, paymentMethod: "yape", status: "pagado", date: daysAgo(2), time: "11:20", notes: "Anuncio mensual", voidedAt: null, createdAt: now, updatedAt: now, deleted: false, syncStatus: "local" },
      { id: crypto.randomUUID(), workspaceId, code: "G000004", description: "Arriendo del local comercial", amount: 850.00, categoryId: arriendo, paymentMethod: "transferencia", status: "pagado", date: daysAgo(3), time: "10:00", notes: "Mes actual", voidedAt: null, createdAt: now, updatedAt: now, deleted: false, syncStatus: "local" },
      { id: crypto.randomUUID(), workspaceId, code: "G000005", description: "Reparación del sistema de aire acondicionado", amount: 160.00, categoryId: mantenimiento, paymentMethod: "tarjeta_debito", status: "pendiente", date: daysAgo(4), time: "16:40", notes: "Cotización aprobada", voidedAt: null, createdAt: now, updatedAt: now, deleted: false, syncStatus: "local" },
      { id: crypto.randomUUID(), workspaceId, code: "G000006", description: "Sueldo quincenal del asistente", amount: 520.00, categoryId: sueldos, paymentMethod: "transferencia", status: "pagado", date: daysAgo(5), time: "09:00", notes: "", voidedAt: null, createdAt: now, updatedAt: now, deleted: false, syncStatus: "local" },
      { id: crypto.randomUUID(), workspaceId, code: "G000007", description: "Caja menor y varios", amount: 75.00, categoryId: otros, paymentMethod: "efectivo", status: "pagado", date: daysAgo(0), time: "20:15", notes: "", voidedAt: null, createdAt: now, updatedAt: now, deleted: false, syncStatus: "local" },
      { id: crypto.randomUUID(), workspaceId, code: "G000008", description: "Mantenimiento preventivo de computadoras", amount: 120.00, categoryId: mantenimiento, paymentMethod: "tarjeta_credito", status: "pagado", date: daysAgo(6), time: "15:00", notes: "", voidedAt: null, createdAt: now, updatedAt: now, deleted: false, syncStatus: "local" },
      { id: crypto.randomUUID(), workspaceId, code: "G000009", description: "Gasto anulado de prueba", amount: 40.00, categoryId: otros, paymentMethod: "efectivo", status: "anulado", date: daysAgo(7), time: "12:00", notes: "Se anuló por error", voidedAt: now, createdAt: now, updatedAt: now, deleted: false, syncStatus: "local" },
    ];

    await db.expenses.bulkAdd(sampleExpenses);
  }

  const investmentCount = await db.investments.where("workspaceId").equals(workspaceId).count();
  if (investmentCount === 0 && invCatIds.length > 0) {
    const now = new Date().toISOString();
    const [maquinaria, equipamiento, herramientas, computacion, muebles, otros] = invCatIds;

    const sampleInvestments: Investment[] = [
      { id: crypto.randomUUID(), workspaceId, name: "Máquina de coser industrial", value: 1450.00, categoryId: maquinaria, supplier: "Importadora Maquipack", paymentMethod: "transferencia", status: "pagado", date: daysAgo(30), notes: "Máquina overlock de 5 hilos", voidedAt: null, createdAt: now, updatedAt: now, deleted: false, syncStatus: "local" },
      { id: crypto.randomUUID(), workspaceId, name: "Computadora para diseño", value: 980.00, categoryId: computacion, supplier: "TechStore S.A.", paymentMethod: "tarjeta_credito", status: "pagado", date: daysAgo(25), notes: "Laptop con 16GB RAM", voidedAt: null, createdAt: now, updatedAt: now, deleted: false, syncStatus: "local" },
      { id: crypto.randomUUID(), workspaceId, name: "Mesa de corte", value: 320.00, categoryId: muebles, supplier: "", paymentMethod: "efectivo", status: "pagado", date: daysAgo(20), notes: "Mesa plegable de 2.4m", voidedAt: null, createdAt: now, updatedAt: now, deleted: false, syncStatus: "local" },
      { id: crypto.randomUUID(), workspaceId, name: "Juego de herramientas", value: 210.00, categoryId: herramientas, supplier: "Ferretería Central", paymentMethod: "efectivo", status: "pendiente", date: daysAgo(12), notes: "Herramientas de mantenimiento", voidedAt: null, createdAt: now, updatedAt: now, deleted: false, syncStatus: "local" },
      { id: crypto.randomUUID(), workspaceId, name: "Impresora de etiquetas", value: 450.00, categoryId: equipamiento, supplier: "Office Depot", paymentMethod: "transferencia", status: "pagado", date: daysAgo(8), notes: "", voidedAt: null, createdAt: now, updatedAt: now, deleted: false, syncStatus: "local" },
      { id: crypto.randomUUID(), workspaceId, name: "Inversión anulada de prueba", value: 150.00, categoryId: otros, supplier: "", paymentMethod: "efectivo", status: "anulado", date: daysAgo(5), notes: "Se anuló por error", voidedAt: now, createdAt: now, updatedAt: now, deleted: false, syncStatus: "local" },
    ];

    await db.investments.bulkAdd(sampleInvestments);
  }

  const customerCount = await db.customers.where("workspaceId").equals(workspaceId).count();
  if (customerCount === 0) {
    const now = new Date().toISOString();
    const sampleCustomers = [
      { name: "Mary", phone: "987 654 321", address: "Av. Principal 123", notes: "Cliente frecuente" },
      { name: "Carlos", phone: "912 345 678", address: "Jr. Los Olivos 456", notes: "" },
      { name: "Luisa", phone: "", address: "Urb. Las Flores Mz B", notes: "Pago en efectivo" },
    ];
    await db.customers.bulkAdd(
      sampleCustomers.map((c) => ({
        id: crypto.randomUUID(),
        workspaceId,
        ...c,
        createdAt: now,
        updatedAt: now,
        deleted: false,
        syncStatus: "local" as const,
      })),
    );
  }

  const productCount = await db.products.where("workspaceId").equals(workspaceId).count();
  if (productCount === 0) {
    const now = new Date().toISOString();
    const sampleProducts = [
      { code: "LEG-001", name: "Leggings", color: "Negro", stock: 40 },
      { code: "LEG-002", name: "Leggings", color: "Gris", stock: 25 },
      { code: "TOP-001", name: "Top deportivo", color: "Blanco", stock: 30 },
      { code: "TOP-002", name: "Top deportivo", color: "Negro", stock: 20 },
      { code: "SHO-001", name: "Short de tela", color: "Beige", stock: 15 },
      { code: "PAN-001", name: "Pantalón cargo", color: "Oliva", stock: 10 },
    ];
    for (const p of sampleProducts) {
      const product = {
        id: crypto.randomUUID(),
        workspaceId,
        code: p.code,
        name: p.name,
        color: p.color,
        categoryId: "",
        createdAt: now,
        updatedAt: now,
        deleted: false,
        syncStatus: "local" as const,
      };
      await db.products.add(product);
      if (p.stock > 0) {
        await db.inventoryMovements.add({
          id: crypto.randomUUID(),
          workspaceId,
          productId: product.id,
          type: "entrada",
          quantity: p.stock,
          referenceType: "inventario_inicial",
          referenceId: product.id,
          notes: `Stock inicial ${p.name}`,
          createdAt: now,
          syncStatus: "local" as const,
        });
      }
    }
  }

  const saleCount = await db.sales.where("workspaceId").equals(workspaceId).count();
  if (saleCount === 0) {
    const now = new Date().toISOString();
    const [mary, carlos, luisa] = (await db.customers.toArray()).filter((c) => c.workspaceId === workspaceId && !c.deleted);
    const products = (await db.products.toArray()).filter((p) => p.workspaceId === workspaceId && !p.deleted);
    const leggings = products.find((p) => p.code === "LEG-001");
    const topBlanco = products.find((p) => p.code === "TOP-001");

    if (mary && leggings && topBlanco) {
      // Venta confirmada: genera SALIDA de inventario.
      const sale1 = {
        id: crypto.randomUUID(),
        workspaceId,
        code: "V000001",
        customerId: mary.id,
        date: daysAgo(0),
        paymentMethod: "efectivo" as const,
        total: 30,
        notes: "Compra de leggings",
        status: "confirmada" as const,
        confirmedAt: now,
        voidedAt: null,
        createdAt: now,
        updatedAt: now,
        deleted: false,
        syncStatus: "local" as const,
      };
      await db.sales.add(sale1);
      await db.saleDetails.bulkAdd([
        { id: crypto.randomUUID(), workspaceId, saleId: sale1.id, productId: leggings.id, code: leggings.code, name: leggings.name, color: leggings.color, quantity: 2, unitPrice: 15, subtotal: 30, createdAt: now, syncStatus: "local" as const },
      ]);
      await db.inventoryMovements.add({
        id: crypto.randomUUID(),
        workspaceId,
        productId: leggings.id,
        type: "salida",
        quantity: 2,
        referenceType: "venta",
        referenceId: sale1.id,
        notes: `Venta ${sale1.code}`,
        createdAt: now,
        syncStatus: "local" as const,
      });

      // Venta pendiente: aún no genera SALIDA.
      const sale2 = {
        id: crypto.randomUUID(),
        workspaceId,
        code: "V000002",
        customerId: carlos?.id ?? mary.id,
        date: daysAgo(0),
        paymentMethod: "yape" as const,
        total: 22.5,
        notes: "",
        status: "pendiente" as const,
        confirmedAt: null,
        voidedAt: null,
        createdAt: now,
        updatedAt: now,
        deleted: false,
        syncStatus: "local" as const,
      };
      await db.sales.add(sale2);
      await db.saleDetails.bulkAdd([
        { id: crypto.randomUUID(), workspaceId, saleId: sale2.id, productId: topBlanco.id, code: topBlanco.code, name: topBlanco.name, color: topBlanco.color, quantity: 3, unitPrice: 7.5, subtotal: 22.5, createdAt: now, syncStatus: "local" as const },
      ]);

      if (luisa) {
        // Venta anulada de prueba.
        const sale3 = {
          id: crypto.randomUUID(),
          workspaceId,
          code: "V000003",
          customerId: luisa.id,
          date: daysAgo(2),
          paymentMethod: "efectivo" as const,
          total: 15,
          notes: "",
          status: "anulada" as const,
          confirmedAt: now,
          voidedAt: now,
          createdAt: now,
          updatedAt: now,
          deleted: false,
          syncStatus: "local" as const,
        };
        await db.sales.add(sale3);
        await db.saleDetails.bulkAdd([
          { id: crypto.randomUUID(), workspaceId, saleId: sale3.id, productId: leggings.id, code: leggings.code, name: leggings.name, color: leggings.color, quantity: 1, unitPrice: 15, subtotal: 15, createdAt: now, syncStatus: "local" as const },
        ]);
      }
    }
  }
}

export async function seedIfEmpty() {
  const workspaceId = useWorkspaceStore.getState().activeWorkspaceId;
  if (!workspaceId) return;
  await seedForWorkspace(workspaceId, true);
}