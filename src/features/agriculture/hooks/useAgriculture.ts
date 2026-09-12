import { useState, useEffect } from "react";
import { liveQuery } from "dexie";
import { db } from "@/lib/db";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import type { Crop, FarmLot, AgroInput, Application, Labor, Harvest } from "@/types/modules";

export function useCrops() {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(true);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    const observable = liveQuery(async () => {
      return db.crops
        .where("workspaceId")
        .equals(activeWorkspaceId)
        .filter((c) => c.deleted !== true)
        .toArray();
    });
    const sub = observable.subscribe({
      next: (data) => { setCrops(data); setLoading(false); },
      error: (error) => { console.error("Dexie: read crops", error); setLoading(false); },
    });
    return () => sub.unsubscribe();
  }, [activeWorkspaceId]);

  const remove = async (id: string) => {
    await db.crops.update(id, { deleted: true, syncStatus: "pending" });
  };

  return { crops, loading, remove };
}

export function useFarmLots() {
  const [farmLots, setFarmLots] = useState<FarmLot[]>([]);
  const [loading, setLoading] = useState(true);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    const observable = liveQuery(async () => {
      return db.farmLots
        .where("workspaceId")
        .equals(activeWorkspaceId)
        .filter((l) => l.deleted !== true)
        .toArray();
    });
    const sub = observable.subscribe({
      next: (data) => { setFarmLots(data); setLoading(false); },
      error: (error) => { console.error("Dexie: read farmLots", error); setLoading(false); },
    });
    return () => sub.unsubscribe();
  }, [activeWorkspaceId]);

  const remove = async (id: string) => {
    await db.farmLots.update(id, { deleted: true, syncStatus: "pending" });
  };

  return { farmLots, loading, remove };
}

export function useAgroInputs() {
  const [agroInputs, setAgroInputs] = useState<AgroInput[]>([]);
  const [loading, setLoading] = useState(true);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    const observable = liveQuery(async () => {
      return db.agroInputs
        .where("workspaceId")
        .equals(activeWorkspaceId)
        .filter((i) => i.deleted !== true)
        .toArray();
    });
    const sub = observable.subscribe({
      next: (data) => { setAgroInputs(data); setLoading(false); },
      error: (error) => { console.error("Dexie: read agroInputs", error); setLoading(false); },
    });
    return () => sub.unsubscribe();
  }, [activeWorkspaceId]);

  const remove = async (id: string) => {
    await db.agroInputs.update(id, { deleted: true, syncStatus: "pending" });
  };

  return { agroInputs, loading, remove };
}

export function useApplications() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    const observable = liveQuery(async () => {
      return db.applications
        .where("workspaceId")
        .equals(activeWorkspaceId)
        .filter((a) => a.deleted !== true)
        .toArray();
    });
    const sub = observable.subscribe({
      next: (data) => { setApplications(data); setLoading(false); },
      error: (error) => { console.error("Dexie: read applications", error); setLoading(false); },
    });
    return () => sub.unsubscribe();
  }, [activeWorkspaceId]);

  const remove = async (id: string) => {
    await db.applications.update(id, { deleted: true, syncStatus: "pending" });
  };

  return { applications, loading, remove };
}

export function useLabors() {
  const [labors, setLabors] = useState<Labor[]>([]);
  const [loading, setLoading] = useState(true);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    const observable = liveQuery(async () => {
      return db.labors
        .where("workspaceId")
        .equals(activeWorkspaceId)
        .filter((l) => l.deleted !== true)
        .toArray();
    });
    const sub = observable.subscribe({
      next: (data) => { setLabors(data); setLoading(false); },
      error: (error) => { console.error("Dexie: read labors", error); setLoading(false); },
    });
    return () => sub.unsubscribe();
  }, [activeWorkspaceId]);

  const remove = async (id: string) => {
    await db.labors.update(id, { deleted: true, syncStatus: "pending" });
  };

  return { labors, loading, remove };
}

export function useHarvests() {
  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [loading, setLoading] = useState(true);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    const observable = liveQuery(async () => {
      return db.harvests
        .where("workspaceId")
        .equals(activeWorkspaceId)
        .filter((h) => h.deleted !== true)
        .toArray();
    });
    const sub = observable.subscribe({
      next: (data) => { setHarvests(data); setLoading(false); },
      error: (error) => { console.error("Dexie: read harvests", error); setLoading(false); },
    });
    return () => sub.unsubscribe();
  }, [activeWorkspaceId]);

  const remove = async (id: string) => {
    await db.harvests.update(id, { deleted: true, syncStatus: "pending" });
  };

  return { harvests, loading, remove };
}
