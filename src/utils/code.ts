import { db } from "@/lib/db";

export async function generateExpenseCode(): Promise<string> {
  const last = await db.expenses.orderBy("code").last();
  const lastNum = last ? parseInt(last.code.replace("G", ""), 10) : 0;
  return `G${String(lastNum + 1).padStart(6, "0")}`;
}
