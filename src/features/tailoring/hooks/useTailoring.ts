import { useState, useEffect } from "react";
import { liveQuery } from "dexie";
import { db } from "@/lib/db";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import type { Garment, Size, Color, Material, ProductionOrder, ProductionMaterial } from "@/types/modules";

function useWorkspaceId() {
  return useWorkspaceStore((s) => s.activeWorkspaceId);
}

export function useGarments() {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [loading, setLoading] = useState(true);
  const workspaceId = useWorkspaceId();

  useEffect(() => {
    if (!workspaceId) { setGarments([]); setLoading(false); return; }

    const observable = liveQuery(async () => {
      const data = await db.garments.where("workspaceId").equals(workspaceId).toArray();
      return data.filter((g) => g.deleted !== true).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });

    const sub = observable.subscribe({
      next: (data) => { setGarments(data); setLoading(false); },
      error: () => setLoading(false),
    });

    return () => sub.unsubscribe();
  }, [workspaceId]);

  return { garments, loading };
}

export function useSizes() {
  const [sizes, setSizes] = useState<Size[]>([]);
  const [loading, setLoading] = useState(true);
  const workspaceId = useWorkspaceId();

  useEffect(() => {
    if (!workspaceId) { setSizes([]); setLoading(false); return; }

    const observable = liveQuery(async () => {
      const data = await db.sizes.where("workspaceId").equals(workspaceId).toArray();
      return data.filter((s) => s.deleted !== true).sort((a, b) => a.sortOrder - b.sortOrder);
    });

    const sub = observable.subscribe({
      next: (data) => { setSizes(data); setLoading(false); },
      error: () => setLoading(false),
    });

    return () => sub.unsubscribe();
  }, [workspaceId]);

  return { sizes, loading };
}

export function useColors() {
  const [colors, setColors] = useState<Color[]>([]);
  const [loading, setLoading] = useState(true);
  const workspaceId = useWorkspaceId();

  useEffect(() => {
    if (!workspaceId) { setColors([]); setLoading(false); return; }

    const observable = liveQuery(async () => {
      const data = await db.garmentColors.where("workspaceId").equals(workspaceId).toArray();
      return data.filter((c) => c.deleted !== true).sort((a, b) => a.name.localeCompare(b.name));
    });

    const sub = observable.subscribe({
      next: (data) => { setColors(data); setLoading(false); },
      error: () => setLoading(false),
    });

    return () => sub.unsubscribe();
  }, [workspaceId]);

  return { colors, loading };
}

export function useMaterials() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const workspaceId = useWorkspaceId();

  useEffect(() => {
    if (!workspaceId) { setMaterials([]); setLoading(false); return; }

    const observable = liveQuery(async () => {
      const data = await db.materials.where("workspaceId").equals(workspaceId).toArray();
      return data.filter((m) => m.deleted !== true).sort((a, b) => a.name.localeCompare(b.name));
    });

    const sub = observable.subscribe({
      next: (data) => { setMaterials(data); setLoading(false); },
      error: () => setLoading(false),
    });

    return () => sub.unsubscribe();
  }, [workspaceId]);

  return { materials, loading };
}

export function useProductionOrders() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const workspaceId = useWorkspaceId();

  useEffect(() => {
    if (!workspaceId) { setOrders([]); setLoading(false); return; }

    const observable = liveQuery(async () => {
      const data = await db.productionOrders.where("workspaceId").equals(workspaceId).toArray();
      return data.filter((o) => o.deleted !== true).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });

    const sub = observable.subscribe({
      next: (data) => { setOrders(data); setLoading(false); },
      error: () => setLoading(false),
    });

    return () => sub.unsubscribe();
  }, [workspaceId]);

  return { orders, loading };
}

export function useProductionMaterials(orderId: string | null) {
  const [materials, setMaterials] = useState<ProductionMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const workspaceId = useWorkspaceId();

  useEffect(() => {
    if (!orderId || !workspaceId) { setMaterials([]); setLoading(false); return; }

    const observable = liveQuery(async () => {
      return db.productionMaterials
        .where("productionOrderId")
        .equals(orderId)
        .filter((m) => m.workspaceId === workspaceId)
        .toArray();
    });

    const sub = observable.subscribe({
      next: (data) => { setMaterials(data); setLoading(false); },
      error: () => setLoading(false),
    });

    return () => sub.unsubscribe();
  }, [orderId, workspaceId]);

  return { materials, loading };
}
