// Server-side data layer: thin, typed query helpers over Supabase.
// All reads go through RLS — these run with the signed-in user's session.

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { LeagueRole } from "@core/league-constants";
import type {
  AvailabilityRow,
  BracketNodeRow,
  DraftPickRow,
  DraftRow,
  GameEventRow,
  GameGuestRow,
  GameRow,
  LineupRow,
  NotificationRow,
  PlayerGameStatRow,
  PostRow,
  SeasonRow,
  TeamRow,
  TeamWithRoster,
  TimeSlotRow,
  TradeRow,
  VenueRow,
} from "@core/types";

export interface LeagueContext {
  id: string;
  name: string;
  slug: string;
  sport: string;
  primary_color: string;
  join_code: string;
  settings: { email_domain?: string; trade_approval?: "auto" | "commissioner" };
  is_demo: boolean;
  role: LeagueRole;
}

/** Deduped per request — safe to call from layout and page. */
export const getLeague = cache(
  async (slug: string): Promise<LeagueContext | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("leagues")
      .select(
        "id, name, slug, sport, primary_color, join_code, settings, is_demo, deleted_at",
      )
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return null;
    // A soft-deleted league is gone from the app until restored from the
    // dashboard's Archived section — even for the commissioner (whose RLS
    // read access exists precisely so that restore can work).
    if (data.deleted_at) return null;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;
    // Must be scoped to me: RLS exposes every member of a league I am in, and
    // maybeSingle() errors on more than one row, so omitting this 404s the
    // entire league the moment it has two members.
    const { data: membership } = await supabase
      .from("league_members")
      .select("role")
      .eq("league_id", data.id)
      .eq("user_id", auth.user.id)
      .eq("status", "active")
      .maybeSingle();
    if (!membership) return null;
    return { ...data, role: membership.role as LeagueRole } as LeagueContext;
  },
);

export const getActiveSeason = cache(
  async (leagueId: string): Promise<SeasonRow | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("seasons")
      .select("*")
      .eq("league_id", leagueId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as SeasonRow) ?? null;
  },
);

export const getSeason = cache(
  async (seasonId: string): Promise<SeasonRow | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("seasons")
      .select("*")
      .eq("id", seasonId)
      .maybeSingle();
    return (data as SeasonRow) ?? null;
  },
);

export async function getSeasons(leagueId: string): Promise<SeasonRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("seasons")
    .select("*")
    .eq("league_id", leagueId)
    .order("created_at", { ascending: false });
  return (data as SeasonRow[]) ?? [];
}

export async function getTimeSlots(leagueId: string): Promise<TimeSlotRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("time_slots")
    .select("id, label, day_of_week, start_time, end_time, kind")
    .eq("league_id", leagueId)
    .order("day_of_week")
    .order("start_time");
  return (data as TimeSlotRow[]) ?? [];
}

export async function getVenues(leagueId: string): Promise<VenueRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("venues")
    .select("id, name, splittable")
    .eq("league_id", leagueId)
    .order("created_at");
  return (data as VenueRow[]) ?? [];
}

/** League teams. External (free-text ad-hoc opponent) teams are excluded by
    default so standings, drafts, and the scheduler never see them — pass
    includeExternal for surfaces that genuinely list every team. */
export async function getTeams(
  seasonId: string,
  { includeExternal = false }: { includeExternal?: boolean } = {},
): Promise<TeamRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("teams")
    .select("id, season_id, name, abbrev, color, captain_id, is_external")
    .eq("season_id", seasonId)
    .order("created_at");
  if (!includeExternal) query = query.eq("is_external", false);
  const { data, error } = await query;
  if (error) {
    // Everything downstream (rosters, standings, drafts) empties out when
    // this fails — never let that happen silently.
    console.error(`getTeams(${seasonId}) failed: ${error.message}`);
  }
  return (data as TeamRow[]) ?? [];
}

export async function getTeamById(teamId: string): Promise<TeamRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("teams")
    .select("id, season_id, name, abbrev, color, captain_id, is_external")
    .eq("id", teamId)
    .maybeSingle();
  return (data as TeamRow) ?? null;
}

export async function getTeamsWithRosters(
  seasonId: string,
): Promise<TeamWithRoster[]> {
  const supabase = await createClient();
  const teams = await getTeams(seasonId);
  // Scoped to this season's teams — the old unscoped read fetched every
  // roster row in every league the caller could see, which was both wasteful
  // and fragile (a single failure emptied every roster in the app).
  const { data: members, error } =
    teams.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("team_members")
          .select(
            "id, team_id, user_id, jersey_number, is_captain, left_at, profile:profiles(full_name)",
          )
          .in("team_id", teams.map((t) => t.id))
          .is("left_at", null);
  if (error) {
    // Surfaces in the server logs — an empty roster caused by a failed read
    // must not be indistinguishable from a genuinely empty roster.
    console.error(`getTeamsWithRosters(${seasonId}) members read failed: ${error.message}`);
  }
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
  for (const t of byTeam.values()) {
    t.roster.sort((a, b) =>
      Number(b.is_captain) - Number(a.is_captain) ||
      a.full_name.localeCompare(b.full_name),
    );
  }
  return [...byTeam.values()];
}

/** Active playing members not on any roster this season. */
export async function getFreeAgents(
  leagueId: string,
  seasonId: string,
): Promise<{ user_id: string; full_name: string; grade: number | null }[]> {
  const supabase = await createClient();
  const [{ data: members }, rostered] = await Promise.all([
    supabase
      .from("league_members")
      .select("user_id, role, profile:profiles(full_name, grade)")
      .eq("league_id", leagueId)
      .eq("status", "active")
      .in("role", ["player", "captain"]),
    getTeamsWithRosters(seasonId),
  ]);
  const taken = new Set(
    rostered.flatMap((t) => t.roster.map((r) => r.user_id)),
  );
  return (members ?? [])
    .filter((m) => !taken.has(m.user_id as string))
    .map((m) => {
      const profile = m.profile as unknown as {
        full_name: string;
        grade: number | null;
      } | null;
      return {
        user_id: m.user_id as string,
        full_name: profile?.full_name || "Unnamed",
        grade: profile?.grade ?? null,
      };
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

/* --------------------------------- draft --------------------------------- */

export async function getDraft(seasonId: string): Promise<DraftRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("drafts")
    .select("*")
    .eq("season_id", seasonId)
    .maybeSingle();
  return (data as DraftRow) ?? null;
}

export async function getDraftPicks(draftId: string): Promise<DraftPickRow[]> {
  const supabase = await createClient();
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
      (p.profile as unknown as { full_name: string } | null)?.full_name ||
      "Unnamed",
  }));
}

export async function getDraftQueue(
  draftId: string,
  teamId: string,
): Promise<{ id: string; user_id: string; rank: number; full_name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("draft_queues")
    .select("id, user_id, rank, profile:profiles(full_name)")
    .eq("draft_id", draftId)
    .eq("team_id", teamId)
    .order("rank");
  return (data ?? []).map((q) => ({
    id: q.id as string,
    user_id: q.user_id as string,
    rank: q.rank as number,
    full_name:
      (q.profile as unknown as { full_name: string } | null)?.full_name ||
      "Unnamed",
  }));
}

/* ------------------------------ availability ------------------------------ */

export async function getSeasonAvailability(
  seasonId: string,
): Promise<AvailabilityRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("availability")
    .select("user_id, time_slot_id, status")
    .eq("season_id", seasonId);
  return (data as AvailabilityRow[]) ?? [];
}

export async function getMyAvailability(
  seasonId: string,
  userId: string,
): Promise<AvailabilityRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("availability")
    .select("user_id, time_slot_id, status")
    .eq("season_id", seasonId)
    .eq("user_id", userId);
  return (data as AvailabilityRow[]) ?? [];
}

/* --------------------------------- games --------------------------------- */

const GAME_SELECT = `id, season_id, week, home_team_id, away_team_id, venue_id,
  time_slot_id, scheduled_date, status, home_score, away_score, period,
  clock_ms, scorekeeper_id, is_playoff, is_adhoc, counts_for_standings,
  rules_override, bracket_node_id,
  home_team:teams!games_home_team_id_fkey(name, abbrev, color),
  away_team:teams!games_away_team_id_fkey(name, abbrev, color),
  time_slot:time_slots(label), venue:venues(name)`;

export async function getGames(seasonId: string): Promise<GameRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("games")
    .select(GAME_SELECT)
    .eq("season_id", seasonId)
    .order("week")
    .order("scheduled_date");
  return (data as unknown as GameRow[]) ?? [];
}

export async function getGame(gameId: string): Promise<GameRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("games")
    .select(GAME_SELECT)
    .eq("id", gameId)
    .maybeSingle();
  return (data as unknown as GameRow) ?? null;
}

export async function getGameEvents(gameId: string): Promise<GameEventRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("game_events")
    .select(
      "id, seq, period, clock_ms, team_id, user_id, guest_id, type, value, related_user_id, related_guest_id, voided, client_uuid",
    )
    .eq("game_id", gameId)
    .order("seq");
  // Merge the player keys: the pure stat/replay logic treats them as opaque,
  // so guest events flow through box scores and the console unchanged.
  // Writers split them back apart (recordEvent payloads from the console).
  return (
    (data as (GameEventRow & { related_guest_id: string | null })[]) ?? []
  ).map((e) => ({
    ...e,
    user_id: e.user_id ?? e.guest_id,
    related_user_id: e.related_user_id ?? e.related_guest_id,
  }));
}

export async function getGameGuests(gameId: string): Promise<GameGuestRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("game_guests")
    .select("id, game_id, team_id, display_name")
    .eq("game_id", gameId)
    .order("created_at");
  return (data as GameGuestRow[]) ?? [];
}

export async function getLineups(gameId: string): Promise<LineupRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lineup_states")
    .select("seq, team_id, on_court")
    .eq("game_id", gameId)
    .order("seq");
  return (data as LineupRow[]) ?? [];
}

/* --------------------------------- stats --------------------------------- */

export async function getSeasonPlayerStats(
  seasonId: string,
): Promise<(PlayerGameStatRow & { user_id: string })[]> {
  const supabase = await createClient();
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
    .in("game_id", ids)
    // guest lines belong to one game only — they have no season identity
    .not("user_id", "is", null);
  return (data ?? []).map((r) => ({
    ...(r as unknown as PlayerGameStatRow & { user_id: string }),
    full_name:
      (r.profile as unknown as { full_name: string } | null)?.full_name ||
      "Unnamed",
  }));
}

export async function getPlayerGameLog(
  seasonId: string,
  userId: string,
): Promise<(PlayerGameStatRow & { game: GameRow })[]> {
  const supabase = await createClient();
  const games = await getGames(seasonId);
  const byId = new Map(games.map((g) => [g.id, g]));
  const { data } = await supabase
    .from("player_game_stats")
    .select("*")
    .eq("user_id", userId)
    .in("game_id", games.map((g) => g.id));
  return ((data as unknown as PlayerGameStatRow[]) ?? [])
    .map((r) => ({ ...r, game: byId.get(r.game_id)! }))
    .filter((r) => r.game)
    .sort((a, b) => (a.game.week ?? 0) - (b.game.week ?? 0));
}

/* --------------------------------- trades --------------------------------- */

export async function getTrades(seasonId: string): Promise<TradeRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("trades")
    .select(
      "id, season_id, from_team_id, to_team_id, status, proposed_by, note, created_at, items:trade_items(user_id, from_team_id, to_team_id, profile:profiles(full_name))",
    )
    .eq("season_id", seasonId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((t) => ({
    ...(t as unknown as Omit<TradeRow, "items">),
    items: ((t.items as unknown[]) ?? []).map((raw) => {
      const it = raw as {
        user_id: string;
        from_team_id: string;
        to_team_id: string;
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

/* ---------------------------------- feed ---------------------------------- */

export async function getPosts(leagueId: string, limit = 20): Promise<PostRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select("id, kind, body, created_at, team_id, author:profiles(full_name)")
    .eq("league_id", leagueId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((p) => ({
    id: p.id as string,
    kind: p.kind as PostRow["kind"],
    body: p.body as string,
    created_at: p.created_at as string,
    team_id: (p.team_id as string | null) ?? null,
    author_name:
      (p.author as unknown as { full_name: string } | null)?.full_name ?? null,
  }));
}

/* ------------------------------ notifications ------------------------------ */

export async function getNotifications(limit = 50): Promise<NotificationRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, category, title, body, link, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as NotificationRow[]) ?? [];
}

export const getUnreadCount = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  return count ?? 0;
});

/* -------------------------------- playoffs -------------------------------- */

export async function getBracketNodes(
  seasonId: string,
): Promise<BracketNodeRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bracket_nodes")
    .select("id, round, position, home_source, away_source, game_id, winner_team_id")
    .eq("season_id", seasonId)
    .order("round")
    .order("position");
  return (data as BracketNodeRow[]) ?? [];
}

/* ---------------------------------- rules ---------------------------------- */

export interface RuleFileRow {
  id: string;
  name: string;
  storage_path: string;
  size_bytes: number;
  created_at: string;
}

export async function getLeagueRules(leagueId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("league_rules")
    .select("content")
    .eq("league_id", leagueId)
    .maybeSingle();
  return (data?.content as string) ?? "";
}

export async function getRuleFiles(leagueId: string): Promise<RuleFileRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rule_files")
    .select("id, name, storage_path, size_bytes, created_at")
    .eq("league_id", leagueId)
    .order("created_at", { ascending: false });
  return (data as RuleFileRow[]) ?? [];
}

/* -------------------------------- standings -------------------------------- */

import { computeStandings } from "@core/standings";
import type { StandingsDisplayRow } from "@/components/standings-table";

export async function getSeasonStandings(seasonId: string): Promise<{
  rows: StandingsDisplayRow[];
  explanations: string[];
}> {
  const [teams, games] = await Promise.all([
    getTeams(seasonId), // external ad-hoc opponents excluded by default
    getGames(seasonId),
  ]);
  const regular = games.filter((g) => !g.is_playoff && g.counts_for_standings);
  const { standings, explanations } = computeStandings(
    teams.map((t) => t.id),
    regular,
  );
  const byId = new Map(teams.map((t) => [t.id, t]));
  return {
    rows: standings.map((s) => ({
      ...s,
      name: byId.get(s.teamId)?.name ?? "Unknown",
      abbrev: byId.get(s.teamId)?.abbrev ?? "?",
      color: byId.get(s.teamId)?.color ?? "#54749b",
    })),
    explanations,
  };
}

/* ---------------------------- league lifecycle ---------------------------- */

export interface LeagueFootprint {
  teams: number;
  members: number;
  games: number;
  statLines: number;
  trades: number;
  bracketNodes: number;
}

/** What a delete would destroy — shown in the danger zone so the
    commissioner sees the scale before typing the league name. */
export async function getLeagueFootprint(
  leagueId: string,
): Promise<LeagueFootprint> {
  const supabase = await createClient();
  const { data: seasonRows } = await supabase
    .from("seasons")
    .select("id")
    .eq("league_id", leagueId);
  const seasonIds = (seasonRows ?? []).map((s) => s.id as string);
  const zero = Promise.resolve({ count: 0 });
  const bySeason = (table: string) =>
    seasonIds.length === 0
      ? zero
      : supabase
          .from(table)
          .select("id", { count: "exact", head: true })
          .in("season_id", seasonIds);

  const gameIds =
    seasonIds.length === 0
      ? []
      : ((
          await supabase.from("games").select("id").in("season_id", seasonIds)
        ).data ?? []).map((g) => g.id as string);

  const [teams, members, games, statLines, trades, bracketNodes] =
    await Promise.all([
      bySeason("teams"),
      supabase
        .from("league_members")
        .select("id", { count: "exact", head: true })
        .eq("league_id", leagueId)
        .eq("status", "active"),
      bySeason("games"),
      gameIds.length === 0
        ? zero
        : supabase
            .from("player_game_stats")
            .select("id", { count: "exact", head: true })
            .in("game_id", gameIds),
      bySeason("trades"),
      bySeason("bracket_nodes"),
    ]);
  return {
    teams: teams.count ?? 0,
    members: members.count ?? 0,
    games: games.count ?? 0,
    statLines: statLines.count ?? 0,
    trades: trades.count ?? 0,
    bracketNodes: bracketNodes.count ?? 0,
  };
}

/* -------------------------------- dashboard -------------------------------- */

export interface MyTeamRow {
  team_id: string;
  team_name: string;
  team_color: string;
  season_id: string;
  season_name: string;
  league_slug: string;
  league_name: string;
}

// cache(): the dashboard and getMyNextGame both need this — one query, not two.
export const getMyTeams = cache(async (userId: string): Promise<MyTeamRow[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("team_members")
    .select(
      "team:teams(id, name, color, season:seasons(id, name, status, league:leagues(slug, name)))",
    )
    .eq("user_id", userId)
    .is("left_at", null);
  return (data ?? [])
    .map((row) => {
      const team = row.team as unknown as {
        id: string;
        name: string;
        color: string;
        season: {
          id: string;
          name: string;
          status: string;
          league: { slug: string; name: string } | null;
        } | null;
      } | null;
      if (!team?.season?.league) return null;
      return {
        team_id: team.id,
        team_name: team.name,
        team_color: team.color,
        season_id: team.season.id,
        season_name: team.season.name,
        league_slug: team.season.league.slug,
        league_name: team.season.league.name,
      };
    })
    .filter((r): r is MyTeamRow => r !== null);
});

export async function getMyNextGame(
  userId: string,
): Promise<(GameRow & { league_slug: string }) | null> {
  const myTeams = await getMyTeams(userId);
  if (myTeams.length === 0) return null;
  const supabase = await createClient();
  const teamIds = myTeams.map((t) => t.team_id);
  const { data } = await supabase
    .from("games")
    .select(GAME_SELECT)
    .in("status", ["scheduled", "live"])
    .or(
      `home_team_id.in.(${teamIds.join(",")}),away_team_id.in.(${teamIds.join(",")})`,
    )
    .order("scheduled_date", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const game = data as unknown as GameRow;
  const seasonTeam = myTeams.find(
    (t) => t.team_id === game.home_team_id || t.team_id === game.away_team_id,
  );
  return { ...game, league_slug: seasonTeam?.league_slug ?? "" };
}

export async function getMyLastStatLine(
  userId: string,
): Promise<(PlayerGameStatRow & { game: GameRow | null }) | null> {
  const supabase = await createClient();
  // The game comes back embedded rather than through a second getGame()
  // call — the two queries were sequential, so this halves the wait on the
  // dashboard's slowest card.
  const { data } = await supabase
    .from("player_game_stats")
    .select(`*, game:games(${GAME_SELECT})`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const { game, ...row } = data as unknown as PlayerGameStatRow & {
    game: GameRow | null;
  };
  return { ...row, game: game ?? null };
}
