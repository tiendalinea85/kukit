import Dexie, { type Table } from "dexie";
import type { Expense, ExpenseDetail, Category, Type } from "@/types";

class ZaneDB extends Dexie {
  expenses!: Table<Expense, string>;
  expenseDetails!: Table<ExpenseDetail, string>;
  categories!: Table<Category, string>;
  types!: Table<Type, string>;

  constructor() {
    super("zane-db");

    this.version(3).stores({
      expenses:
        "id, code, name, categoryId, typeId, date, createdAt, updatedAt, status, amount, hasDetails, totalAmount, itemsCount, deleted, syncStatus",
      expenseDetails:
        "id, expenseId, syncStatus",
      categories:
        "id, name, syncStatus",
      types:
        "id, name, syncStatus",
    });
  }
}

export const db = new ZaneDB();
