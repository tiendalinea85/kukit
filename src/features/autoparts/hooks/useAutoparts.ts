import { useState, useEffect } from "react";
import { liveQuery } from "dexie";
import { db } from "@/lib/db";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import type { VehicleBrand, VehicleModel, AutoPart, PartCompatibility } from "@/types/modules";

export function useVehicleBrands() {
  const [brands, setBrands] = useState<VehicleBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  useEffect(() => {
    if (!workspaceId) { setBrands([]); setLoading(false); return; }

    const observable = liveQuery(async () => {
      return db.vehicleBrands
        .where("workspaceId")
        .equals(workspaceId)
        .filter((b) => b.deleted !== true)
        .toArray();
    });

    const sub = observable.subscribe({
      next: (data) => { setBrands(data); setLoading(false); },
      error: (error) => { console.error("Dexie: read vehicleBrands", error); setLoading(false); },
    });

    return () => sub.unsubscribe();
  }, [workspaceId]);

  return { brands, loading };
}

export function useVehicleModels(brandId?: string) {
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [loading, setLoading] = useState(true);
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  useEffect(() => {
    if (!workspaceId) { setModels([]); setLoading(false); return; }

    const observable = liveQuery(async () => {
      return db.vehicleModels
        .where("workspaceId")
        .equals(workspaceId)
        .filter((m) => m.deleted !== true && (!brandId || m.brandId === brandId))
        .toArray();
    });

    const sub = observable.subscribe({
      next: (data) => { setModels(data); setLoading(false); },
      error: (error) => { console.error("Dexie: read vehicleModels", error); setLoading(false); },
    });

    return () => sub.unsubscribe();
  }, [workspaceId, brandId]);

  return { models, loading };
}

export function useAutoParts() {
  const [parts, setParts] = useState<AutoPart[]>([]);
  const [loading, setLoading] = useState(true);
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  useEffect(() => {
    if (!workspaceId) { setParts([]); setLoading(false); return; }

    const observable = liveQuery(async () => {
      return db.autoParts
        .where("workspaceId")
        .equals(workspaceId)
        .filter((p) => p.deleted !== true)
        .toArray();
    });

    const sub = observable.subscribe({
      next: (data) => { setParts(data); setLoading(false); },
      error: (error) => { console.error("Dexie: read autoParts", error); setLoading(false); },
    });

    return () => sub.unsubscribe();
  }, [workspaceId]);

  return { parts, loading };
}

export function usePartCompatibilities(partId?: string) {
  const [compatibilities, setCompatibilities] = useState<PartCompatibility[]>([]);
  const [loading, setLoading] = useState(true);
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  useEffect(() => {
    if (!workspaceId) { setCompatibilities([]); setLoading(false); return; }

    const observable = liveQuery(async () => {
      return db.partCompatibilities
        .where("workspaceId")
        .equals(workspaceId)
        .filter((c) => c.deleted !== true && (!partId || c.partId === partId))
        .toArray();
    });

    const sub = observable.subscribe({
      next: (data) => { setCompatibilities(data); setLoading(false); },
      error: (error) => { console.error("Dexie: read partCompatibilities", error); setLoading(false); },
    });

    return () => sub.unsubscribe();
  }, [workspaceId, partId]);

  return { compatibilities, loading };
}
