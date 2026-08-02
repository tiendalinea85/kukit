import { getSupabase } from "./supabase";
import { db } from "./db";
import type { Expense, ExpenseDetail, Category, Type } from "@/types";

function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : false;
}

function client() {
  return getSupabase();
}

export async function syncExpensesToSupabase() {
  if (!isOnline()) return;
  const sb = client();
  if (!sb) return;

  const pending = await db.expenses.where({ syncStatus: "pending" }).toArray();
  if (!pending.length) return;

  for (const expense of pending) {
    const payload = {
      id: expense.id,
      code: expense.code,
      name: expense.name,
      description: expense.description,
      amount: expense.amount,
      category_id: expense.categoryId,
      type_id: expense.typeId,
      payment_method: expense.paymentMethod,
      status: expense.status,
      date: expense.date,
      time: expense.time,
      notes: expense.notes,
      deleted: expense.deleted,
      has_details: expense.hasDetails,
      total_amount: expense.totalAmount,
      items_count: expense.itemsCount,
      created_at: expense.createdAt,
      updated_at: expense.updatedAt,
    };

    const { error } = await sb.from("expenses").upsert(payload, {
      onConflict: "id",
      ignoreDuplicates: false,
    });

    if (!error) {
      await db.expenses.update(expense.id, { syncStatus: "synced" });
    }
  }
}

export async function syncExpenseDetailsToSupabase() {
  if (!isOnline()) return;
  const sb = client();
  if (!sb) return;

  const pending = await db.expenseDetails.where({ syncStatus: "pending" }).toArray();
  if (!pending.length) return;

  for (const detail of pending) {
    const payload = {
      id: detail.id,
      expense_id: detail.expenseId,
      product_name: detail.productName,
      quantity: detail.quantity,
      unit_price: detail.unitPrice,
      subtotal: detail.subtotal,
      created_at: detail.createdAt,
    };

    const { error } = await sb.from("expense_details").upsert(payload, {
      onConflict: "id",
      ignoreDuplicates: false,
    });

    if (!error) {
      await db.expenseDetails.update(detail.id, { syncStatus: "synced" });
    }
  }
}

export async function syncCategoriesToSupabase() {
  if (!isOnline()) return;
  const sb = client();
  if (!sb) return;

  const pending = await db.categories.where({ syncStatus: "pending" }).toArray();
  if (!pending.length) return;

  for (const cat of pending) {
    const { error } = await sb.from("categories").upsert(
      {
        id: cat.id,
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
        created_at: cat.createdAt,
      },
      { onConflict: "id", ignoreDuplicates: false }
    );

    if (!error) {
      await db.categories.update(cat.id, { syncStatus: "synced" });
    }
  }
}

export async function syncTypesToSupabase() {
  if (!isOnline()) return;
  const sb = client();
  if (!sb) return;

  const pending = await db.types.where({ syncStatus: "pending" }).toArray();
  if (!pending.length) return;

  for (const t of pending) {
    const { error } = await sb.from("types").upsert(
      {
        id: t.id,
        name: t.name,
        created_at: t.createdAt,
      },
      { onConflict: "id", ignoreDuplicates: false }
    );

    if (!error) {
      await db.types.update(t.id, { syncStatus: "synced" });
    }
  }
}

export async function syncAllToSupabase() {
  await Promise.all([
    syncExpensesToSupabase(),
    syncExpenseDetailsToSupabase(),
    syncCategoriesToSupabase(),
    syncTypesToSupabase(),
  ]);
}

export async function pullFromSupabase() {
  if (!isOnline()) return;
  const sb = client();
  if (!sb) return;

  const { data: expenses, error: expErr } = await sb
    .from("expenses")
    .select("*");

  if (!expErr && expenses) {
    for (const e of expenses) {
      const local = await db.expenses.get(e.id);
      const remoteUpdated = new Date(e.updated_at).getTime();
      const localUpdated = local ? new Date(local.updatedAt).getTime() : 0;
      if (local && localUpdated >= remoteUpdated) continue;

      const mapped: Expense = {
        id: e.id,
        code: e.code,
        name: e.name,
        description: e.description || "",
        amount: Number(e.amount),
        categoryId: e.category_id || "",
        typeId: e.type_id || "",
        paymentMethod: e.payment_method || "efectivo",
        status: e.status || "activo",
        date: e.date,
        time: e.time || "00:00",
        notes: e.notes || "",
        hasDetails: e.has_details || false,
        totalAmount: Number(e.total_amount) || Number(e.amount),
        itemsCount: e.items_count || 0,
        createdAt: e.created_at,
        updatedAt: e.updated_at,
        deleted: e.deleted || false,
        syncStatus: "synced",
      };
      await db.expenses.put(mapped);
    }
  }

  const { data: expenseDetails, error: detErr } = await sb
    .from("expense_details")
    .select("*");

  if (!detErr && expenseDetails) {
    for (const d of expenseDetails) {
      const mapped: ExpenseDetail = {
        id: d.id,
        expenseId: d.expense_id,
        productName: d.product_name,
        quantity: d.quantity,
        unitPrice: d.unit_price,
        subtotal: d.subtotal,
        createdAt: d.created_at,
        syncStatus: "synced",
      };
      await db.expenseDetails.put(mapped);
    }
  }

  const { data: categories, error: catErr } = await sb
    .from("categories")
    .select("*");

  if (!catErr && categories) {
    for (const c of categories) {
      const mapped: Category = {
        id: c.id,
        name: c.name,
        color: c.color,
        icon: c.icon,
        createdAt: c.created_at,
        syncStatus: "synced",
      };
      await db.categories.put(mapped);
    }
  }

  const { data: types, error: typErr } = await sb
    .from("types")
    .select("*");

  if (!typErr && types) {
    for (const t of types) {
      const mapped: Type = {
        id: t.id,
        name: t.name,
        createdAt: t.created_at,
        syncStatus: "synced",
      };
      await db.types.put(mapped);
    }
  }
}
