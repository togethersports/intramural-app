import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { LeagueRole } from "@core/league-constants";

export { isLeagueAdmin, sportLabel } from "@core/league-constants";
export type { LeagueRole };

export interface LeagueSummary {
  id: string;
  name: string;
  slug: string;
  sport: string;
  primary_color: string;
  join_code: string;
  role: LeagueRole;
}

export interface MemberRow {
  id: string;
  user_id: string;
  role: LeagueRole;
  full_name: string;
  grade: number | null;
}

export async function getMyLeagues(): Promise<LeagueSummary[]> {
  const supabase = await createClient();
  // getUser() from lib/auth, not supabase.auth.getUser(): the Supabase call
  // re-validates the JWT against the auth server every time, so calling it
  // here cost a second network round trip on top of the one requireUser()
  // already made. The cached wrapper reuses that result for the request.
  const user = await getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("league_members")
    .select(
      "role, league:leagues(id, name, slug, sport, primary_color, join_code, archived_at, deleted_at)",
    )
    // Scope to MY memberships. RLS makes every member of a league I belong to
    // visible — rosters need that — so without this the league comes back once
    // per member, and the second person to join duplicates it.
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data
    .map((row): LeagueSummary | null => {
      const league = row.league as unknown as
        | (Omit<LeagueSummary, "role"> & {
            archived_at: string | null;
            deleted_at: string | null;
          })
        | null;
      // active list only — archived and deleted leagues live in the
      // dashboard's Archived section (getShelvedLeagues)
      if (!league || league.archived_at || league.deleted_at) return null;
      return {
        id: league.id,
        name: league.name,
        slug: league.slug,
        sport: league.sport,
        primary_color: league.primary_color,
        join_code: league.join_code,
        role: row.role as LeagueRole,
      };
    })
    .filter((l): l is LeagueSummary => l !== null);
}

export interface ShelvedLeague {
  id: string;
  name: string;
  slug: string;
  role: LeagueRole;
  archived_at: string | null;
  deleted_at: string | null;
  /** Days left in the recovery window; null for merely-archived leagues. */
  days_remaining: number | null;
}

export const DELETE_RECOVERY_DAYS = 30;

/** Archived and recently-deleted leagues for the dashboard's Archived
    section. RLS already hides other people's deleted leagues — a deleted
    league is only readable by its admins during the recovery window. */
export async function getShelvedLeagues(): Promise<ShelvedLeague[]> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("league_members")
    .select("role, league:leagues(id, name, slug, archived_at, deleted_at)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data
    .map((row) => {
      const league = row.league as unknown as {
        id: string;
        name: string;
        slug: string;
        archived_at: string | null;
        deleted_at: string | null;
      } | null;
      if (!league || (!league.archived_at && !league.deleted_at)) return null;
      const days = league.deleted_at
        ? Math.max(
            0,
            DELETE_RECOVERY_DAYS -
              Math.floor(
                (Date.now() - new Date(league.deleted_at).getTime()) / 86_400_000,
              ),
          )
        : null;
      return { ...league, role: row.role as LeagueRole, days_remaining: days };
    })
    .filter((l): l is ShelvedLeague => l !== null);
}

export async function getLeagueBySlug(
  slug: string,
): Promise<LeagueSummary | null> {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  // One round trip, not three. This used to fetch the league, then call
  // supabase.auth.getUser(), then fetch the membership — three sequential
  // waits on every league page. An inner join on the embedded league does
  // the same work in a single request.
  //
  // The user_id filter is load-bearing, not an optimisation: RLS makes every
  // member of a league you belong to visible, so without it this matches one
  // row per member and maybeSingle() treats more than one as an error — the
  // whole league 404s as soon as a second person joins.
  const { data, error } = await supabase
    .from("league_members")
    .select(
      "role, league:leagues!inner(id, name, slug, sport, primary_color, join_code)",
    )
    .eq("league.slug", slug)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) return null;
  const league = data.league as unknown as Omit<LeagueSummary, "role"> | null;
  if (!league) return null;
  return { ...league, role: data.role as LeagueRole };
}

export async function getLeagueMembers(leagueId: string): Promise<MemberRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("league_members")
    .select("id, user_id, role, profile:profiles(full_name, grade)")
    .eq("league_id", leagueId)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data.map((row) => {
    const profile = row.profile as unknown as {
      full_name: string;
      grade: number | null;
    } | null;
    return {
      id: row.id as string,
      user_id: row.user_id as string,
      role: row.role as LeagueRole,
      full_name: profile?.full_name || "Unnamed player",
      grade: profile?.grade ?? null,
    };
  });
}

