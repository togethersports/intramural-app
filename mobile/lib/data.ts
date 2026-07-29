/**
 * Mobile data layer. Same tables, same RLS as the web app — the queries are
 * ports of lib/data.ts, minus anything that only makes sense on a server.
 */
import { supabase } from "./supabase";
import type {
  GameRow,
  NotificationRow,
  PlayerGameStatRow,
  SeasonRow,
  TeamRow,
  TeamWithRoster,
  TimeSlotRow,
} from "@core/types";

export interface LeagueSummary {
  id: string;
  name: string;
  slug: string;
  sport: string;
  primary_color: string;
  role: string;
}

const GAME_SELECT = `id, season_id, week, home_team_id, away_team_id, venue_id,
  time_slot_id, scheduled_date, status, home_score, away_score, period,
  clock_ms, scorekeeper_id, is_playoff, bracket_node_id,
  home_team:teams!games_home_team_id_fkey(name, abbrev, color),
  away_team:teams!games_away_team_id_fkey(name, abbrev, color),
  time_slot:time_slots(label), venue:venues(name)`;

export async function getMyLeagues(): Promise<LeagueSummary[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data } = await supabase
    .from("league_members")
    .select("role, league:leagues(id, name, slug, sport, primary_color)")
    // Scope to MY memberships. RLS makes every member of a league I belong to
    // visible — rosters need that — so without this the league comes back once
    // per member, giving the Me tab duplicate rows with duplicate React keys.
    .eq("user_id", auth.user.id)
    .eq("status", "active");
  return (data ?? [])
    .map((r) => {
      const l = r.league as unknown as Omit<LeagueSummary, "role"> | null;
      return l ? { ...l, role: r.role as string } : null;
    })
    .filter((r): r is LeagueSummary => r !== null);
}

export async function getActiveSeason(leagueId: string): Promise<SeasonRow | null> {
  const { data } = await supabase
    .from("seasons")
    .select("*")
    .eq("league_id", leagueId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as SeasonRow) ?? null;
}

export interface MyTeam {
  team_id: string;
  team_name: string;
  team_color: string;
  team_abbrev: string;
  season_id: string;
  league_slug: string;
  league_name: string;
  league_id: string;
}

export async function getMyTeams(userId: string): Promise<MyTeam[]> {
  const { data } = await supabase
    .from("team_members")
    .select(
      "team:teams(id, name, color, abbrev, season:seasons(id, league:leagues(id, slug, name)))",
    )
    .eq("user_id", userId)
    .is("left_at", null);
  return (data ?? [])
    .map((row) => {
      const t = row.team as unknown as {
        id: string; name: string; color: string; abbrev: string;
        season: { id: string; league: { id: string; slug: string; name: string } | null } | null;
      } | null;
      if (!t?.season?.league) return null;
      return {
        team_id: t.id,
        team_name: t.name,
        team_color: t.color,
        team_abbrev: t.abbrev,
        season_id: t.season.id,
        league_slug: t.season.league.slug,
        league_name: t.season.league.name,
        league_id: t.season.league.id,
      };
    })
    .filter((r): r is MyTeam => r !== null);
}

export async function getGames(seasonId: string): Promise<GameRow[]> {
  const { data } = await supabase
    .from("games")
    .select(GAME_SELECT)
    .eq("season_id", seasonId)
    .order("week")
    .order("scheduled_date");
  return (data as unknown as GameRow[]) ?? [];
}

export async function getUpcomingGames(teamIds: string[]): Promise<GameRow[]> {
  if (teamIds.length === 0) return [];
  const { data } = await supabase
    .from("games")
    .select(GAME_SELECT)
    .in("status", ["scheduled", "live"])
    .or(
      `home_team_id.in.(${teamIds.join(",")}),away_team_id.in.(${teamIds.join(",")})`,
    )
    .order("scheduled_date", { ascending: true, nullsFirst: false })
    .limit(10);
  return (data as unknown as GameRow[]) ?? [];
}

export async function getGame(gameId: string): Promise<GameRow | null> {
  const { data } = await supabase
    .from("games")
    .select(GAME_SELECT)
    .eq("id", gameId)
    .maybeSingle();
  return (data as unknown as GameRow) ?? null;
}

export async function getGameEvents(gameId: string) {
  const { data } = await supabase
    .from("game_events")
    .select(
      "id, seq, period, clock_ms, team_id, user_id, type, value, related_user_id, voided, client_uuid",
    )
    .eq("game_id", gameId)
    .order("seq");
  return data ?? [];
}

export async function getLineups(gameId: string) {
  const { data } = await supabase
    .from("lineup_states")
    .select("seq, team_id, on_court")
    .eq("game_id", gameId)
    .order("seq");
  return data ?? [];
}

export async function getTeams(seasonId: string): Promise<TeamRow[]> {
  const { data } = await supabase
    .from("teams")
    .select("id, season_id, name, abbrev, color, captain_id")
    .eq("season_id", seasonId)
    .order("created_at");
  return (data as TeamRow[]) ?? [];
}

export async function getTeamsWithRosters(
  seasonId: string,
): Promise<TeamWithRoster[]> {
  const [teams, { data: members }] = await Promise.all([
    getTeams(seasonId),
    supabase
      .from("team_members")
      .select("id, team_id, user_id, jersey_number, is_captain, left_at, profile:profiles(full_name)")
      .is("left_at", null),
  ]);
  const byTeam = new Map<string, TeamWithRoster>();
  for (const t of teams) byTeam.set(t.id, { ...t, roster: [] });
  for (const m of members ?? []) {
    const team = byTeam.get(m.team_id as string);
    if (!team) continue;
    const profile = m.profile as unknown as { full_name: string } | null;
    team.roster.push({
      id: m.id as string,
      user_id: m.user_id as string,
      full_name: profile?.full_name || "Unnamed",
      jersey_number: (m.jersey_number as number | null) ?? null,
      is_captain: Boolean(m.is_captain),
    });
  }
  return [...byTeam.values()];
}

export async function getSeasonPlayerStats(
  seasonId: string,
): Promise<PlayerGameStatRow[]> {
  const { data: games } = await supabase
    .from("games")
    .select("id")
    .eq("season_id", seasonId)
    .in("status", ["final", "forfeit"]);
  const ids = (games ?? []).map((g) => g.id as string);
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("player_game_stats")
    .select("*, profile:profiles(full_name)")
    .in("game_id", ids);
  return (data ?? []).map((r) => ({
    ...(r as unknown as PlayerGameStatRow),
    full_name:
      (r.profile as unknown as { full_name: string } | null)?.full_name ||
      "Unnamed",
  }));
}

export async function getTimeSlots(leagueId: string): Promise<TimeSlotRow[]> {
  const { data } = await supabase
    .from("time_slots")
    .select("id, label, day_of_week, start_time, end_time, kind")
    .eq("league_id", leagueId)
    .order("day_of_week")
    .order("start_time");
  return (data as TimeSlotRow[]) ?? [];
}

export async function getMyAvailability(seasonId: string, userId: string) {
  const { data } = await supabase
    .from("availability")
    .select("time_slot_id, status")
    .eq("season_id", seasonId)
    .eq("user_id", userId);
  return data ?? [];
}

export async function setAvailability(
  userId: string,
  seasonId: string,
  timeSlotId: string,
  status: "yes" | "maybe" | "no",
): Promise<string | null> {
  const { error } = await supabase.from("availability").upsert(
    { user_id: userId, season_id: seasonId, time_slot_id: timeSlotId, status },
    { onConflict: "user_id,season_id,time_slot_id" },
  );
  return error?.message ?? null;
}

export async function getNotifications(): Promise<NotificationRow[]> {
  const { data } = await supabase
    .from("notifications")
    .select("id, category, title, body, link, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data as NotificationRow[]) ?? [];
}

export async function markAllRead() {
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
}

export async function getLeagueRules(leagueId: string): Promise<string> {
  const { data } = await supabase
    .from("league_rules")
    .select("content")
    .eq("league_id", leagueId)
    .maybeSingle();
  return (data?.content as string) ?? "";
}

export async function getRuleFiles(leagueId: string) {
  const { data } = await supabase
    .from("rule_files")
    .select("id, name, storage_path, size_bytes, created_at")
    .eq("league_id", leagueId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function signedRuleUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("rules").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export async function joinLeague(code: string): Promise<string | null> {
  const { error } = await supabase.rpc("join_league_with_code", {
    p_code: code.trim().toUpperCase(),
  });
  return error?.message ?? null;
}
