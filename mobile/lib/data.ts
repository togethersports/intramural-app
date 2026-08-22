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
  /** The same settings blob the web reads — jersey numbers, trade approval. */
  settings?: { jersey_numbers?: boolean; trade_approval?: string } | null;
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
    .select(
      "role, league:leagues(id, name, slug, sport, primary_color, settings, archived_at, deleted_at)",
    )
    // Scope to MY memberships. RLS makes every member of a league I belong to
    // visible — rosters need that — so without this the league comes back once
    // per member, giving the Me tab duplicate rows with duplicate React keys.
    .eq("user_id", auth.user.id)
    .eq("status", "active")
    // First-joined first, and STABLE — screens that fall back to "my first
    // league" (rules) must agree with "my first team" (schedule, standings)
    // instead of drifting on whatever order the database returns.
    .order("created_at", { ascending: true });
  return (data ?? [])
    .map((r) => {
      const l = r.league as unknown as
        | (Omit<LeagueSummary, "role"> & {
            archived_at: string | null;
            deleted_at: string | null;
          })
        | null;
      // RLS hides a deleted league from members, but deliberately not from
      // its admins — that read access is what makes restore possible. Which
      // means the filter has to happen here too, or the commissioner's own
      // phone keeps listing every league they ever deleted.
      if (!l || l.archived_at || l.deleted_at) return null;
      const { archived_at: _a, deleted_at: _d, ...league } = l;
      return { ...league, role: r.role as string };
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
      "team:teams(id, name, color, abbrev, season:seasons(id, league:leagues(id, slug, name, archived_at, deleted_at)))",
    )
    .eq("user_id", userId)
    .is("left_at", null);
  return (data ?? [])
    .map((row) => {
      const t = row.team as unknown as {
        id: string; name: string; color: string; abbrev: string;
        season: {
          id: string;
          league: {
            id: string; slug: string; name: string;
            archived_at: string | null; deleted_at: string | null;
          } | null;
        } | null;
      } | null;
      // Same reasoning as getMyLeagues: admins can still read their deleted
      // leagues (for restore), so the lifecycle filter must happen here or a
      // deleted league's team keeps driving the schedule and standings tabs.
      if (!t?.season?.league) return null;
      if (t.season.league.archived_at || t.season.league.deleted_at) return null;
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

/** How many people are on each of these teams, right now. Home shows the
    count next to the team; pulling whole rosters for one number would be a
    much heavier query for the same answer. */
export async function getTeammateCounts(
  teamIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (teamIds.length === 0) return counts;
  const { data } = await supabase
    .from("team_members")
    .select("team_id")
    .in("team_id", teamIds)
    .is("left_at", null);
  for (const row of data ?? []) {
    const id = row.team_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
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
    .select("id, name, storage_path, size_bytes, created_at, is_primary")
    .eq("league_id", leagueId)
    // Same order as the web: the pinned rule sheet first, then newest. The
    // rules screen shows whichever of these it lands on inline, so the two
    // platforms must agree on which document that is.
    .order("is_primary", { ascending: false })
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

/* ------------------------------------------------------- teams and people --
   Read paths the phone was missing entirely: who is on which team, and how
   one player's season has gone. Same queries the web runs, same RLS. */

export interface LeagueMemberRow {
  user_id: string;
  role: string;
  full_name: string;
  avatar_url: string | null;
  grade: number | null;
}

export async function getLeagueMembers(leagueId: string): Promise<LeagueMemberRow[]> {
  const { data } = await supabase
    .from("league_members")
    .select("user_id, role, profile:profiles(full_name, avatar_url, grade)")
    .eq("league_id", leagueId)
    .eq("status", "active");
  return (data ?? []).map((m) => {
    const p = m.profile as unknown as {
      full_name: string; avatar_url: string | null; grade: number | null;
    } | null;
    return {
      user_id: m.user_id as string,
      role: m.role as string,
      full_name: p?.full_name || "Unnamed",
      avatar_url: p?.avatar_url ?? null,
      grade: p?.grade ?? null,
    };
  });
}

/* ------------------------------------------------------------------ draft -- */

export interface DraftRow {
  id: string;
  season_id: string;
  format: string;
  pick_seconds: number;
  rounds: number;
  pick_order: string[];
  status: string;
  current_pick_no: number;
  last_pick_at: string | null;
}

export interface DraftPickRow {
  pick_no: number;
  round: number;
  team_id: string;
  user_id: string;
  auto_picked: boolean;
  full_name: string;
}

export async function getDraft(seasonId: string): Promise<DraftRow | null> {
  const { data } = await supabase
    .from("drafts")
    .select("*")
    .eq("season_id", seasonId)
    .maybeSingle();
  return (data as DraftRow) ?? null;
}

export async function getDraftPicks(draftId: string): Promise<DraftPickRow[]> {
  const { data } = await supabase
    .from("draft_picks")
    .select("pick_no, round, team_id, user_id, auto_picked, profile:profiles(full_name)")
    .eq("draft_id", draftId)
    .order("pick_no");
  return (data ?? []).map((p) => ({
    pick_no: p.pick_no as number,
    round: p.round as number,
    team_id: p.team_id as string,
    user_id: p.user_id as string,
    auto_picked: Boolean(p.auto_picked),
    full_name:
      (p.profile as unknown as { full_name: string } | null)?.full_name || "Unnamed",
  }));
}

/** Whose turn it is, from the same RPC the web asks. */
export async function draftPickTeam(draftId: string, pickNo: number): Promise<string | null> {
  const { data } = await supabase.rpc("draft_pick_team", {
    p_draft: draftId,
    p_pick_no: pickNo,
  });
  return (data as string) ?? null;
}

/** The pick itself. The RPC owns the whole rule set — order, eligibility,
    roster limits — so a phone tapping this cannot draft out of turn. */
export async function makeDraftPick(draftId: string, userId: string): Promise<string | null> {
  const { error } = await supabase.rpc("make_pick", { p_draft: draftId, p_user: userId });
  return error?.message ?? null;
}

/* ----------------------------------------------------------------- trades -- */

export interface TradeItem {
  user_id: string;
  from_team_id: string;
  to_team_id: string;
  full_name: string;
}

export interface TradeRow {
  id: string;
  season_id: string;
  from_team_id: string;
  to_team_id: string;
  status: string;
  proposed_by: string;
  note: string | null;
  created_at: string;
  items: TradeItem[];
}

export async function getTrades(seasonId: string): Promise<TradeRow[]> {
  const { data } = await supabase
    .from("trades")
    .select(
      "id, season_id, from_team_id, to_team_id, status, proposed_by, note, created_at, items:trade_items(user_id, from_team_id, to_team_id, profile:profiles(full_name))",
    )
    .eq("season_id", seasonId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((t) => ({
    id: t.id as string,
    season_id: t.season_id as string,
    from_team_id: t.from_team_id as string,
    to_team_id: t.to_team_id as string,
    status: t.status as string,
    proposed_by: t.proposed_by as string,
    note: (t.note as string | null) ?? null,
    created_at: t.created_at as string,
    items: ((t.items as unknown[]) ?? []).map((raw) => {
      const it = raw as {
        user_id: string; from_team_id: string; to_team_id: string;
        profile: { full_name: string } | null;
      };
      return {
        user_id: it.user_id,
        from_team_id: it.from_team_id,
        to_team_id: it.to_team_id,
        full_name: it.profile?.full_name || "Unnamed",
      };
    }),
  }));
}

export async function respondTrade(tradeId: string, accept: boolean): Promise<string | null> {
  const { error } = await supabase.rpc("respond_trade", {
    p_trade: tradeId,
    p_accept: accept,
  });
  return error?.message ?? null;
}

export async function proposeTrade(input: {
  seasonId: string;
  fromTeamId: string;
  toTeamId: string;
  offer: string[];
  request: string[];
  note: string;
}): Promise<string | null> {
  const { error } = await supabase.rpc("propose_trade", {
    p_season: input.seasonId,
    p_from_team: input.fromTeamId,
    p_to_team: input.toTeamId,
    p_offer: input.offer,
    p_request: input.request,
    p_note: input.note,
  });
  return error?.message ?? null;
}

/* -------------------------------------------------------------- playoffs -- */

export interface BracketNodeRow {
  id: string;
  round: number;
  position: number;
  home_source: string;
  away_source: string;
  game_id: string | null;
  winner_team_id: string | null;
}

export async function getBracketNodes(seasonId: string): Promise<BracketNodeRow[]> {
  const { data } = await supabase
    .from("bracket_nodes")
    .select("id, round, position, home_source, away_source, game_id, winner_team_id")
    .eq("season_id", seasonId)
    .order("round")
    .order("position");
  return (data as BracketNodeRow[]) ?? [];
}
