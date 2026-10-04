import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { db } from "../../../lib/db.ts";
import { useWorkspaceStore } from "../../../stores/useWorkspaceStore.ts";
import {
  createCategory,
  deleteCategory,
  getCategoryByName,
  listCategories,
  updateCategory,
} from "./categoryService.ts";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "../domain/categoryRules.ts";

const WS_A = "ws-a";
const WS_B = "ws-b";

const STYLED = { color: "#22c55e", icon: "🏠" };

beforeEach(async () => {
  useWorkspaceStore.setState({ activeWorkspaceId: WS_A });
  await db.categories.clear();
  await db.syncOutbox.clear();
});

describe("createCategory", () => {
  it("crea la categoría con id de cliente, workspace activo y syncStatus pending", async () => {
    const category = await createCategory({ name: "Alquiler", ...STYLED });
    assert.match(category.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.equal(category.workspaceId, WS_A);
    assert.equal(category.name, "Alquiler");
    assert.equal(category.color, "#22c55e");
    assert.equal(category.icon, "🏠");
    assert.equal(category.syncStatus, "pending");
  });

  it("normaliza el nombre", async () => {
    const category = await createCategory({ name: "  Papelería  escolar ", ...STYLED });
    assert.equal(category.name, "Papelería escolar");
  });

  it("lanza error con nombre vacío", async () => {
    await assert.rejects(createCategory({ name: "   ", ...STYLED }), /obligatorio/i);
  });

  it("lanza error si ya existe una categoría con el mismo nombre", async () => {
    await createCategory({ name: "Alquiler", ...STYLED });
    await assert.rejects(
      createCategory({ name: "alquiler", ...STYLED }),
      /ya existe/i,
    );
  });

  it("permite el mismo nombre en otro workspace", async () => {
    await createCategory({ name: "Alquiler", ...STYLED });
    useWorkspaceStore.setState({ activeWorkspaceId: WS_B });
    const category = await createCategory({ name: "Alquiler", ...STYLED });
    assert.equal(category.workspaceId, WS_B);
  });

  it("propone color e icono libres cuando no vienen", async () => {
    const category = await createCategory({ name: "Alquiler", color: "", icon: "" });
    assert.ok(CATEGORY_COLORS.includes(category.color as (typeof CATEGORY_COLORS)[number]));
    assert.ok(CATEGORY_ICONS.includes(category.icon as (typeof CATEGORY_ICONS)[number]));
  });

  it("no repite un color que ya usa otra categoría", async () => {
    const first = await createCategory({ name: "Alquiler", ...STYLED });
    const second = await createCategory({ name: "Servicios", color: "", icon: "" });
    assert.notEqual(second.color, first.color);
  });
});

describe("listCategories", () => {
  it("devuelve solo las categorías del workspace activo", async () => {
    await createCategory({ name: "Servicios", ...STYLED });
    await createCategory({ name: "Alquiler", ...STYLED });
    useWorkspaceStore.setState({ activeWorkspaceId: WS_B });
    await createCategory({ name: "Cosecha", ...STYLED });

    const list = await listCategories();
    assert.deepEqual(list.map((c) => c.name), ["Cosecha"]);
  });

  it("acepta un workspace explícito y ordena por nombre", async () => {
    await createCategory({ name: "Servicios", ...STYLED });
    await createCategory({ name: "Alquiler", ...STYLED });
    useWorkspaceStore.setState({ activeWorkspaceId: WS_B });
    await createCategory({ name: "Cosecha", ...STYLED });

    const list = await listCategories(WS_A);
    assert.deepEqual(list.map((c) => c.name), ["Alquiler", "Servicios"]);
  });
});

describe("getCategoryByName", () => {
  it("encuentra la categoría ignorando mayúsculas y acentos", async () => {
    const created = await createCategory({ name: "Mantenimiento", ...STYLED });
    const found = await getCategoryByName("mantenimiento");
    assert.equal(found?.id, created.id);
  });

  it("devuelve undefined si no existe", async () => {
    await createCategory({ name: "Mantenimiento", ...STYLED });
    assert.equal(await getCategoryByName("Servicios"), undefined);
  });
});

describe("updateCategory", () => {
  it("actualiza nombre, color e icono y marca pending", async () => {
    const category = await createCategory({ name: "Alquiler", ...STYLED });
    category.syncStatus = "synced";
    await db.categories.update(category.id, { syncStatus: "synced" });

    await updateCategory(category.id, { name: " Arriendo ", color: "#3b82f6", icon: "🏘️" });

    const updated = await db.categories.get(category.id);
    assert.equal(updated!.name, "Arriendo");
    assert.equal(updated!.color, "#3b82f6");
    assert.equal(updated!.icon, "🏘️");
    assert.equal(updated!.syncStatus, "pending");
  });

  it("lanza error cuando la categoría no existe", async () => {
    await assert.rejects(
      updateCategory("id-falso", { name: "X", ...STYLED }),
      /no encontrada/i,
    );
  });

  it("lanza error si el nombre choca con otra categoría", async () => {
    await createCategory({ name: "Alquiler", ...STYLED });
    const other = await createCategory({ name: "Servicios", ...STYLED });
    await assert.rejects(
      updateCategory(other.id, { name: "alquiler", ...STYLED }),
      /ya existe/i,
    );
  });

  it("permite guardar la misma categoría sin cambios de nombre", async () => {
    const category = await createCategory({ name: "Alquiler", ...STYLED });
    await updateCategory(category.id, { name: "Alquiler", color: "#ef4444", icon: "📦" });
    const updated = await db.categories.get(category.id);
    assert.equal(updated!.color, "#ef4444");
  });

  it("no deja editar una categoría de otro workspace", async () => {
    const category = await createCategory({ name: "Alquiler", ...STYLED });
    useWorkspaceStore.setState({ activeWorkspaceId: WS_B });

    await assert.rejects(
      updateCategory(category.id, { name: "Arriendo", ...STYLED }),
      /otro workspace/i,
    );
    const untouched = await db.categories.get(category.id);
    assert.equal(untouched!.name, "Alquiler");
  });
});

describe("deleteCategory", () => {
  it("elimina la fila local y encola la operación de borrado", async () => {
    const category = await createCategory({ name: "Alquiler", ...STYLED });
    await deleteCategory(category.id);

    assert.equal(await db.categories.get(category.id), undefined);

    const op = await db.syncOutbox.where("[entity+entityId]").equals(["categories", category.id]).first();
    assert.ok(op);
    assert.equal(op!.op, "delete");
    assert.equal(op!.workspaceId, WS_A);
    assert.equal(op!.state, "pending");
  });

  it("lanza error cuando la categoría no existe", async () => {
    await assert.rejects(deleteCategory("id-falso"), /no encontrada/i);
  });

  it("reemplaza una operación de upsert pendiente por la de borrado", async () => {
    const category = await createCategory({ name: "Alquiler", ...STYLED });
    await db.syncOutbox.add({
      id: "op-1",
      entity: "categories",
      entityId: category.id,
      workspaceId: WS_A,
      op: "upsert",
      payload: { id: category.id },
      payloadHash: "h1",
      state: "pending",
      attempts: 0,
      lastError: null,
      lastErrorType: null,
      createdAt: "2026-08-18T10:00:00.000Z",
      updatedAt: "2026-08-18T10:00:00.000Z",
      lastAttemptAt: null,
      retryAt: null,
    });

    await deleteCategory(category.id);

    const ops = await db.syncOutbox.where("entity").equals("categories").toArray();
    assert.equal(ops.length, 1);
    assert.equal(ops[0].op, "delete");
  });

  it("no deja borrar una categoría de otro workspace", async () => {
    const category = await createCategory({ name: "Alquiler", ...STYLED });
    useWorkspaceStore.setState({ activeWorkspaceId: WS_B });

    await assert.rejects(deleteCategory(category.id), /otro workspace/i);
    assert.ok(await db.categories.get(category.id));
    assert.equal(await db.syncOutbox.count(), 0);
  });
});
