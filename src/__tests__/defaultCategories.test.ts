import "fake-indexeddb/auto";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { db } from "../lib/db.ts";
import { DEFAULT_CATEGORIES, seedCategoriesIfEmpty } from "../lib/defaultCategories.ts";
import { useWorkspaceStore } from "../stores/useWorkspaceStore.ts";

beforeEach(async () => {
  useWorkspaceStore.setState({ activeWorkspaceId: null });
  await db.categories.clear();
});

test("seedCategoriesIfEmpty crea las categorías por defecto con syncStatus pending", async () => {
  useWorkspaceStore.setState({ activeWorkspaceId: "ws-test" });

  const seeded = await seedCategoriesIfEmpty("user-1");
  assert.equal(seeded, true);

  const rows = await db.categories.toArray();
  assert.equal(rows.length, DEFAULT_CATEGORIES.length);
  for (const row of rows) {
    assert.equal(row.workspaceId, "ws-test");
    assert.equal(row.syncStatus, "pending");
    assert.ok(DEFAULT_CATEGORIES.some((c) => c.name === row.name));
  }
});

test("seedCategoriesIfEmpty es idempotente y no pisa categorías existentes", async () => {
  await seedCategoriesIfEmpty("user-1");
  const again = await seedCategoriesIfEmpty("user-1");
  assert.equal(again, false);
  assert.equal(await db.categories.count(), DEFAULT_CATEGORIES.length);
});

test("seedCategoriesIfEmpty sin usuario no crea nada", async () => {
  const seeded = await seedCategoriesIfEmpty(null);
  assert.equal(seeded, false);
  assert.equal(await db.categories.count(), 0);
});