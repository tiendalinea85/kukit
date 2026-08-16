import { db } from "@/lib/db";

export async function generateExpenseCode(): Promise<string> {
  const last = await db.expenses.orderBy("code").last();
  const lastNum = last ? parseInt(last.code.replace("G", ""), 10) : 0;
  return `G${String(lastNum + 1).padStart(6, "0")}`;
}

export async function generateSaleCode(): Promise<string> {
  const last = await db.sales.orderBy("code").last();
  const lastNum = last ? parseInt(last.code.replace("V", ""), 10) : 0;
  return `V${String(lastNum + 1).padStart(6, "0")}`;
}

export async function generatePurchaseCode(): Promise<string> {
  const last = await db.purchases.orderBy("code").last();
  const lastNum = last ? parseInt(last.code.replace("C", ""), 10) : 0;
  return `C${String(lastNum + 1).padStart(6, "0")}`;
}
