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
  logo_url: string | null;
  join_code: string;
  settings: {
    email_domain?: string;
    trade_approval?: "auto" | "commissioner";
    /** The league's palette, set by a commissioner in the Console. */
    appearance?: { preset?: string; accent?: string };
  };
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
        "id, name, slug, sport, primary_color, logo_url, join_code, settings, is_demo, deleted_at",
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
    .select("id, season_id, name, abbrev, color, logo_url, captain_id, is_external")
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
    .select("id, season_id, name, abbrev, color, logo_url, captain_id, is_external")
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
            "id, team_id, user_id, jersey_number, is_captain, position, lineup_role, lineup_order, left_at, profile:profiles(full_name, avatar_url)",
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
    const profile = m.profile as unknown as {
      full_name: string;
      avatar_url: string | null;
    } | null;
    team.roster.push({
      id: m.id as string,
      user_id: m.user_id as string,
      full_name: profile?.full_name || "Unnamed",
      avatar_url: profile?.avatar_url ?? null,
      jersey_number: (m.jersey_number as number | null) ?? null,
      is_captain: Boolean(m.is_captain),
      position: (m.position as string | null) ?? null,
      lineup_role: m.lineup_role === "starter" ? "starter" : "reserve",
      lineup_order: (m.lineup_order as number | null) ?? null,
    });
  }
  for (const t of byTeam.values()) {
    // Starters first in the captain's own order, then everyone else — the
    // roster reads as the lineup rather than as an alphabetical list.
    t.roster.sort(
      (a, b) =>
        Number(b.lineup_role === "starter") - Number(a.lineup_role === "starter") ||
        (a.lineup_order ?? 99) - (b.lineup_order ?? 99) ||
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
): Promise<
  {
    user_id: string;
    full_name: string;
    avatar_url: string | null;
    grade: number | null;
  }[]
> {
  const supabase = await createClient();
  const [{ data: members }, rostered] = await Promise.all([
    supabase
      .from("league_members")
      .select("user_id, role, profile:profiles(full_name, avatar_url, grade)")
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
        avatar_url: string | null;
        grade: number | null;
      } | null;
      return {
        user_id: m.user_id as string,
        full_name: profile?.full_name || "Unnamed",
        avatar_url: profile?.avatar_url ?? null,
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
): Promise<
  (PlayerGameStatRow & { user_id: string; avatar_url: string | null })[]
> {
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
    .select("*, profile:profiles(full_name, avatar_url)")
    .in("game_id", ids)
    // guest lines belong to one game only — they have no season identity
    .not("user_id", "is", null);
  return (data ?? []).map((r) => {
    const profile = r.profile as unknown as {
      full_name: string;
      avatar_url: string | null;
    } | null;
    return {
      ...(r as unknown as PlayerGameStatRow & { user_id: string }),
      full_name: profile?.full_name || "Unnamed",
      avatar_url: profile?.avatar_url ?? null,
    };
  });
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

/**
 * How many trades are still waiting on somebody. Head-only count so the
 * sidebar badge costs a number rather than every trade's items.
 */
export const getOpenTradeCount = cache(
  async (seasonId: string): Promise<number> => {
    const supabase = await createClient();
    const { count } = await supabase
      .from("trades")
      .select("id", { count: "exact", head: true })
      .eq("season_id", seasonId)
      .in("status", ["proposed", "accepted"]);
    return count ?? 0;
  },
);

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

/* ------------------------------ subs & polls -------------------------------
   Everything the sub-request and scheduling-poll surfaces read. Kept here
   with the rest of the query layer so RLS stays the only place access is
   decided. */

export interface SubRequestRow {
  id: string;
  game_id: string;
  team_id: string;
  team_name: string;
  requested_by: string;
  absent_user_id: string | null;
  absent_name: string | null;
  fill_user_id: string | null;
  fill_name: string | null;
  scope: "team" | "league";
  status: "open" | "proposed" | "approved" | "declined" | "cancelled";
  note: string;
  decision_note: string;
  created_at: string;
}

export async function getSubRequests(gameId: string): Promise<SubRequestRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sub_requests")
    .select(
      "id, game_id, team_id, requested_by, absent_user_id, fill_user_id, scope, status, note, decision_note, created_at, team:teams(name), absent:profiles!sub_requests_absent_user_id_fkey(full_name), fill:profiles!sub_requests_fill_user_id_fkey(full_name)",
    )
    .eq("game_id", gameId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error(`getSubRequests(${gameId}) failed: ${error.message}`);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id as string,
    game_id: r.game_id as string,
    team_id: r.team_id as string,
    team_name: (r.team as unknown as { name: string } | null)?.name ?? "—",
    requested_by: r.requested_by as string,
    absent_user_id: (r.absent_user_id as string | null) ?? null,
    absent_name:
      (r.absent as unknown as { full_name: string } | null)?.full_name ?? null,
    fill_user_id: (r.fill_user_id as string | null) ?? null,
    fill_name: (r.fill as unknown as { full_name: string } | null)?.full_name ?? null,
    scope: r.scope as SubRequestRow["scope"],
    status: r.status as SubRequestRow["status"],
    note: (r.note as string) ?? "",
    decision_note: (r.decision_note as string) ?? "",
    created_at: r.created_at as string,
  }));
}

export async function getGameAbsences(
  gameId: string,
): Promise<{ user_id: string; team_id: string; reason: string; full_name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("game_absences")
    .select("user_id, team_id, reason, profile:profiles(full_name)")
    .eq("game_id", gameId);
  return (data ?? []).map((a) => ({
    user_id: a.user_id as string,
    team_id: a.team_id as string,
    reason: (a.reason as string) ?? "",
    full_name:
      (a.profile as unknown as { full_name: string } | null)?.full_name ?? "Unnamed",
  }));
}

export interface PollOptionRow {
  id: string;
  scheduled_date: string;
  time_slot_id: string | null;
  slot_label: string | null;
  venue_id: string | null;
  venue_name: string | null;
  yes: number;
  maybe: number;
  no: number;
  myVote: "yes" | "maybe" | "no" | null;
}

export interface SchedulePollRow {
  id: string;
  season_id: string;
  game_id: string | null;
  home_team_id: string;
  away_team_id: string;
  home_team_name: string;
  away_team_name: string;
  title: string;
  status: "open" | "locked" | "cancelled";
  closes_at: string | null;
  locked_option_id: string | null;
  created_at: string;
  options: PollOptionRow[];
}

/** Open and recently locked polls for a season, with live vote counts. */
export async function getSchedulePolls(
  seasonId: string,
): Promise<SchedulePollRow[]> {
  const supabase = await createClient();
  const [{ data: polls, error }, { data: auth }] = await Promise.all([
    supabase
      .from("schedule_polls")
      .select(
        "id, season_id, game_id, home_team_id, away_team_id, title, status, closes_at, locked_option_id, created_at, home:teams!schedule_polls_home_team_id_fkey(name), away:teams!schedule_polls_away_team_id_fkey(name), options:schedule_poll_options(id, scheduled_date, time_slot_id, venue_id, slot:time_slots(label), venue:venues(name))",
      )
      .eq("season_id", seasonId)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false }),
    supabase.auth.getUser(),
  ]);
  if (error) {
    console.error(`getSchedulePolls(${seasonId}) failed: ${error.message}`);
    return [];
  }

  const optionIds = (polls ?? []).flatMap((p) =>
    ((p.options as unknown[]) ?? []).map((o) => (o as { id: string }).id),
  );
  const { data: votes } =
    optionIds.length === 0
      ? { data: [] }
      : await supabase
          .from("schedule_poll_votes")
          .select("option_id, user_id, vote")
          .in("option_id", optionIds);

  const tally = new Map<string, { yes: number; maybe: number; no: number }>();
  const mine = new Map<string, "yes" | "maybe" | "no">();
  const me = auth?.user?.id;
  for (const v of votes ?? []) {
    const bucket = tally.get(v.option_id as string) ?? { yes: 0, maybe: 0, no: 0 };
    bucket[v.vote as "yes" | "maybe" | "no"] += 1;
    tally.set(v.option_id as string, bucket);
    if (me && v.user_id === me) {
      mine.set(v.option_id as string, v.vote as "yes" | "maybe" | "no");
    }
  }

  return (polls ?? []).map((p) => ({
    id: p.id as string,
    season_id: p.season_id as string,
    game_id: (p.game_id as string | null) ?? null,
    home_team_id: p.home_team_id as string,
    away_team_id: p.away_team_id as string,
    home_team_name: (p.home as unknown as { name: string } | null)?.name ?? "Home",
    away_team_name: (p.away as unknown as { name: string } | null)?.name ?? "Away",
    title: (p.title as string) ?? "",
    status: p.status as SchedulePollRow["status"],
    closes_at: (p.closes_at as string | null) ?? null,
    locked_option_id: (p.locked_option_id as string | null) ?? null,
    created_at: p.created_at as string,
    options: (((p.options as unknown[]) ?? []) as Record<string, unknown>[])
      .map((o) => {
        const counts = tally.get(o.id as string) ?? { yes: 0, maybe: 0, no: 0 };
        return {
          id: o.id as string,
          scheduled_date: o.scheduled_date as string,
          time_slot_id: (o.time_slot_id as string | null) ?? null,
          slot_label:
            (o.slot as unknown as { label: string } | null)?.label ?? null,
          venue_id: (o.venue_id as string | null) ?? null,
          venue_name: (o.venue as unknown as { name: string } | null)?.name ?? null,
          ...counts,
          myVote: mine.get(o.id as string) ?? null,
        };
      })
      .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date)),
  }));
}

/* --------------------------- recaps and awards ---------------------------- */

export interface GameRecapRow {
  headline: string;
  body: string;
  source: string;
  created_at: string;
}

export async function getGameRecap(gameId: string): Promise<GameRecapRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("game_recaps")
    .select("headline, body, source, created_at")
    .eq("game_id", gameId)
    .maybeSingle();
  return (data as GameRecapRow) ?? null;
}

export interface WeeklyAwardRow {
  week: number;
  user_id: string | null;
  team_id: string | null;
  full_name: string;
  team_name: string;
  headline: string;
  blurb: string;
  stat_line: Record<string, number>;
  source: string;
}

/** The most recent Player of the Week card for a season. */
export async function getLatestAward(
  seasonId: string,
): Promise<WeeklyAwardRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("weekly_awards")
    .select(
      "week, user_id, team_id, headline, blurb, stat_line, source, profile:profiles(full_name), team:teams(name)",
    )
    .eq("season_id", seasonId)
    .eq("category", "player_of_the_week")
    .order("week", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    week: data.week as number,
    user_id: (data.user_id as string | null) ?? null,
    team_id: (data.team_id as string | null) ?? null,
    full_name:
      (data.profile as unknown as { full_name: string } | null)?.full_name ??
      "Unnamed player",
    team_name: (data.team as unknown as { name: string } | null)?.name ?? "—",
    headline: (data.headline as string) ?? "",
    blurb: (data.blurb as string) ?? "",
    stat_line: (data.stat_line as Record<string, number>) ?? {},
    source: (data.source as string) ?? "",
  };
}
