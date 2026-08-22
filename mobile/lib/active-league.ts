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

/* ------------------------------------------------------- the league context --
   Every tab used to start from "my team": getMyTeams(), take the first, use
   its season. That silently made a roster spot the price of admission — a
   commissioner who runs a league without playing in it saw an empty app,
   because a team they do not have could not name a season.
   The league is what someone belongs to; the team is optional decoration on
   top of it. So resolution starts at the league, takes the active season
   from the league, and treats a team as a nice-to-have. */

import { getActiveSeason, getMyLeagues, getMyTeams, type LeagueSummary, type MyTeam } from "./data";

export interface LeagueContext {
  league: LeagueSummary;
  /** The league's active season — null only before one is created. */
  seasonId: string | null;
  /** My team in this league, when I play in it. */
  team: MyTeam | null;
  /** Commissioner or admin: the roles the database lets write. */
  isAdmin: boolean;
}

export async function loadLeagueContext(
  userId: string,
): Promise<LeagueContext | null> {
  const leagues = await getMyLeagues();
  const league = resolveLeague(leagues, getActiveLeague());
  if (!league) return null;
  const [season, teams] = await Promise.all([
    getActiveSeason(league.id),
    getMyTeams(userId),
  ]);
  return {
    league,
    seasonId: season?.id ?? teams.find((t) => t.league_id === league.id)?.season_id ?? null,
    team: teams.find((t) => t.league_id === league.id) ?? null,
    isAdmin: league.role === "commissioner" || league.role === "admin",
  };
}
