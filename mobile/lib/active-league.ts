/**
 * Which league the tabs are showing.
 *
 * Home, Schedule and League all used to read `teams[0]` — whichever
 * membership the database happened to return first — so anyone in two
 * leagues could see one of them and had no way to reach the other. This is
 * the choice, shared: a module store with listeners (no context, same shape
 * as lib/canvas.tsx), remembered across launches.
 *
 * The stored id is a *preference*, not a guarantee: a league you left is
 * still in AsyncStorage, so every reader resolves it against the leagues it
 * actually has and falls back to the first one.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

const KEY = "intramural.activeLeague";

let current: string | null = null;
const listeners = new Set<(id: string | null) => void>();

export async function loadActiveLeague(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(KEY);
    if (stored) {
      current = stored;
      listeners.forEach((l) => l(current));
    }
  } catch {
    // A missing preference is not a failure — the fallback is the first league.
  }
}

export function setActiveLeague(id: string): void {
  current = id;
  listeners.forEach((l) => l(current));
  void AsyncStorage.setItem(KEY, id).catch(() => {});
}

export function getActiveLeague(): string | null {
  return current;
}

export function useActiveLeague(): string | null {
  const [id, setId] = useState<string | null>(current);
  useEffect(() => {
    listeners.add(setId);
    return () => {
      listeners.delete(setId);
    };
  }, []);
  return id;
}

/** The chosen league if it is still one of mine, else the first one. */
export function resolveLeague<T extends { id: string }>(
  leagues: T[],
  chosen: string | null,
): T | null {
  if (leagues.length === 0) return null;
  return leagues.find((l) => l.id === chosen) ?? leagues[0];
}

/** My team in the chosen league, else my first team anywhere. */
export function resolveTeam<T extends { league_id: string }>(
  teams: T[],
  chosen: string | null,
): T | null {
  if (teams.length === 0) return null;
  return teams.find((t) => t.league_id === chosen) ?? teams[0];
}
