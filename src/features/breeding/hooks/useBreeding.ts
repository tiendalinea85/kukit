import { useState, useEffect } from "react";
import { liveQuery } from "dexie";
import { db } from "@/lib/db";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import type {
  Species,
  Animal,
  BreedingLot,
  Feeding,
  Reproduction,
  LivestockProduction,
} from "@/types/modules";

function useWorkspaceId() {
  return useWorkspaceStore((s) => s.activeWorkspaceId);
}

export function useSpecies() {
  const [species, setSpecies] = useState<Species[]>([]);
  const [loading, setLoading] = useState(true);
  const workspaceId = useWorkspaceId();

  useEffect(() => {
    if (!workspaceId) { setSpecies([]); setLoading(false); return; }

    const observable = liveQuery(async () => {
      const data = await db.species.where("workspaceId").equals(workspaceId).toArray();
      return data.filter((s) => s.deleted !== true).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });

    const sub = observable.subscribe({
      next: (data) => { setSpecies(data); setLoading(false); },
      error: () => setLoading(false),
    });

    return () => sub.unsubscribe();
  }, [workspaceId]);

  return { species, loading };
}

export function useAnimals() {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const workspaceId = useWorkspaceId();

  useEffect(() => {
    if (!workspaceId) { setAnimals([]); setLoading(false); return; }

    const observable = liveQuery(async () => {
      const data = await db.animals.where("workspaceId").equals(workspaceId).toArray();
      return data.filter((a) => a.deleted !== true).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });

    const sub = observable.subscribe({
      next: (data) => { setAnimals(data); setLoading(false); },
      error: () => setLoading(false),
    });

    return () => sub.unsubscribe();
  }, [workspaceId]);

  return { animals, loading };
}

export function useBreedingLots() {
  const [lots, setLots] = useState<BreedingLot[]>([]);
  const [loading, setLoading] = useState(true);
  const workspaceId = useWorkspaceId();

  useEffect(() => {
    if (!workspaceId) { setLots([]); setLoading(false); return; }

    const observable = liveQuery(async () => {
      const data = await db.breedingLots.where("workspaceId").equals(workspaceId).toArray();
      return data.filter((l) => l.deleted !== true).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });

    const sub = observable.subscribe({
      next: (data) => { setLots(data); setLoading(false); },
      error: () => setLoading(false),
    });

    return () => sub.unsubscribe();
  }, [workspaceId]);

  return { lots, loading };
}

export function useFeedings() {
  const [feedings, setFeedings] = useState<Feeding[]>([]);
  const [loading, setLoading] = useState(true);
  const workspaceId = useWorkspaceId();

  useEffect(() => {
    if (!workspaceId) { setFeedings([]); setLoading(false); return; }

    const observable = liveQuery(async () => {
      const data = await db.feedings.where("workspaceId").equals(workspaceId).toArray();
      return data.filter((f) => f.deleted !== true).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });

    const sub = observable.subscribe({
      next: (data) => { setFeedings(data); setLoading(false); },
      error: () => setLoading(false),
    });

    return () => sub.unsubscribe();
  }, [workspaceId]);

  return { feedings, loading };
}

export function useReproductions() {
  const [reproductions, setReproductions] = useState<Reproduction[]>([]);
  const [loading, setLoading] = useState(true);
  const workspaceId = useWorkspaceId();

  useEffect(() => {
    if (!workspaceId) { setReproductions([]); setLoading(false); return; }

    const observable = liveQuery(async () => {
      const data = await db.reproductions.where("workspaceId").equals(workspaceId).toArray();
      return data.filter((r) => r.deleted !== true).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });

    const sub = observable.subscribe({
      next: (data) => { setReproductions(data); setLoading(false); },
      error: () => setLoading(false),
    });

    return () => sub.unsubscribe();
  }, [workspaceId]);

  return { reproductions, loading };
}

export function useLivestockProductions() {
  const [productions, setProductions] = useState<LivestockProduction[]>([]);
  const [loading, setLoading] = useState(true);
  const workspaceId = useWorkspaceId();

  useEffect(() => {
    if (!workspaceId) { setProductions([]); setLoading(false); return; }

    const observable = liveQuery(async () => {
      const data = await db.livestockProductions.where("workspaceId").equals(workspaceId).toArray();
      return data.filter((p) => p.deleted !== true).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });

    const sub = observable.subscribe({
      next: (data) => { setProductions(data); setLoading(false); },
      error: () => setLoading(false),
    });

    return () => sub.unsubscribe();
  }, [workspaceId]);

  return { productions, loading };
}
