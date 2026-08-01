"use server";

import { revalidatePath } from "next/cache";
import { getGame, getGameEvents, getLineups, getSeasonAvailability, getTeams, getTeamsWithRosters } from "@/lib/data";
import { computeBoxScore } from "@core/stats";
import { generateSchedule, slotDateFor } from "@core/scheduler";
import { computeStandings } from "@core/standings";
import { buildBracket } from "@core/bracket";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type ActionState = { error: string | null; notice?: string | null };

const NOT_CONFIGURED = "Backend not configured — see /setup.";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function revalidateLeague(slug: string) {
  revalidatePath(`/league/${slug}`, "layout");
}

/* --------------------------------- console --------------------------------- */

export async function updateLeagueSettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const slug = str(formData, "slug");
  const supabase = await createClient();
  const { error } = await supabase
    .from("leagues")
    .update({
      name: str(formData, "name") || undefined,
      primary_color: str(formData, "color") || undefined,
      settings: {
        email_domain: str(formData, "email_domain") || undefined,
        trade_approval:
          str(formData, "trade_approval") === "auto" ? "auto" : "commissioner",
      },
    })
    .eq("slug", slug);
  if (error) return { error: error.message };
  revalidateLeague(slug);
  return { error: null, notice: "Settings saved." };
}

export async function createSeason(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const slug = str(formData, "slug");
  const leagueId = str(formData, "league_id");
  const name = str(formData, "name");
  const startsOn = str(formData, "starts_on");
  const numWeeks = parseInt(str(formData, "num_weeks") || "6", 10);
  if (!name || !startsOn) return { error: "Name and start date are required." };
  const ends = new Date(`${startsOn}T00:00:00Z`);
  ends.setUTCDate(ends.getUTCDate() + numWeeks * 7 + 21); // regular season + playoff margin
  const supabase = await createClient();
  const { error } = await supabase.from("seasons").insert({
    league_id: leagueId,
    name,
    starts_on: startsOn,
    ends_on: ends.toISOString().slice(0, 10),
    num_weeks: numWeeks,
    rules: {
      roster_min: parseInt(str(formData, "roster_min") || "4", 10),
      roster_max: parseInt(str(formData, "roster_max") || "10", 10),
      min_players_per_slot: parseInt(str(formData, "min_players") || "4", 10),
      max_games_per_team_per_week: parseInt(str(formData, "max_games_week") || "1", 10),
      matchups_per_pair: parseInt(str(formData, "matchups_per_pair") || "1", 10),
    },
  });
  if (error) return { error: error.message };
  revalidateLeague(slug);
  return { error: null, notice: "Season created." };
}

export async function setSeasonStatus(formData: FormData) {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  await supabase
    .from("seasons")
    .update({ status: str(formData, "status") })
    .eq("id", str(formData, "season_id"));
  revalidateLeague(str(formData, "slug"));
}

export async function addTimeSlot(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const supabase = await createClient();
  const { error } = await supabase.from("time_slots").insert({
    league_id: str(formData, "league_id"),
    label: str(formData, "label"),
    day_of_week: parseInt(str(formData, "day_of_week"), 10),
    start_time: str(formData, "start_time"),
    end_time: str(formData, "end_time"),
    kind: str(formData, "kind") || "lunch",
  });
  if (error) return { error: error.message };
  revalidateLeague(str(formData, "slug"));
  return { error: null };
}

export async function deleteTimeSlot(formData: FormData) {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  await supabase.from("time_slots").delete().eq("id", str(formData, "slot_id"));
  revalidateLeague(str(formData, "slug"));
}

export async function addVenue(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const supabase = await createClient();
  const { error } = await supabase.from("venues").insert({
    league_id: str(formData, "league_id"),
    name: str(formData, "name"),
    splittable: formData.get("splittable") === "on",
  });
  if (error) return { error: error.message };
  revalidateLeague(str(formData, "slug"));
  return { error: null };
}

export async function deleteVenue(formData: FormData) {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  await supabase.from("venues").delete().eq("id", str(formData, "venue_id"));
  revalidateLeague(str(formData, "slug"));
}

/* ---------------------------------- teams ---------------------------------- */

export async function createTeam(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const name = str(formData, "name");
  if (name.length < 2) return { error: "Team name is too short." };
  const captainId = str(formData, "captain_id");
  const supabase = await createClient();
  const { data: team, error } = await supabase
    .from("teams")
    .insert({
      season_id: str(formData, "season_id"),
      name,
      abbrev: str(formData, "abbrev") || name.slice(0, 3).toUpperCase(),
      color: str(formData, "color") || "#54749b",
      captain_id: captainId || null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  if (captainId && team) {
    await supabase.from("team_members").insert({
      team_id: team.id,
      user_id: captainId,
      is_captain: true,
    });
    await supabase
      .from("league_members")
      .update({ role: "captain" })
      .eq("league_id", str(formData, "league_id"))
      .eq("user_id", captainId)
      .eq("role", "player");
  }
  revalidateLeague(str(formData, "slug"));
  return { error: null };
}

export async function deleteTeam(formData: FormData) {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  await supabase.from("teams").delete().eq("id", str(formData, "team_id"));
  revalidateLeague(str(formData, "slug"));
}

export async function addPlayerToTeam(formData: FormData) {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  await supabase.from("team_members").insert({
    team_id: str(formData, "team_id"),
    user_id: str(formData, "user_id"),
  });
  revalidateLeague(str(formData, "slug"));
}

export async function removeFromTeam(formData: FormData) {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  await supabase
    .from("team_members")
    .update({ left_at: new Date().toISOString() })
    .eq("id", str(formData, "member_id"));
  revalidateLeague(str(formData, "slug"));
}

export async function setJersey(formData: FormData) {
  if (!isSupabaseConfigured()) return;
  const n = parseInt(str(formData, "jersey_number"), 10);
  const supabase = await createClient();
  await supabase
    .from("team_members")
    .update({ jersey_number: Number.isFinite(n) ? n : null })
    .eq("id", str(formData, "member_id"));
  revalidateLeague(str(formData, "slug"));
}

/* ---------------------------------- draft ---------------------------------- */

export async function createDraft(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const seasonId = str(formData, "season_id");
  const teams = await getTeams(seasonId);
  if (teams.length < 2) return { error: "Create at least two teams first." };
  const supabase = await createClient();
  const { error } = await supabase.from("drafts").insert({
    season_id: seasonId,
    format: str(formData, "format") === "linear" ? "linear" : "snake",
    pick_seconds: parseInt(str(formData, "pick_seconds") || "60", 10),
    rounds: parseInt(str(formData, "rounds") || "5", 10),
    pick_order: teams.map((t) => t.id),
  });
  if (error) return { error: error.message };
  await supabase
    .from("seasons")
    .update({ status: "draft" })
    .eq("id", seasonId)
    .eq("status", "setup");
  revalidateLeague(str(formData, "slug"));
  return { error: null };
}

export async function setDraftStatus(formData: FormData) {
  if (!isSupabaseConfigured()) return;
  const status = str(formData, "status");
  if (!["live", "paused", "setup"].includes(status)) return;
  const supabase = await createClient();
  await supabase
    .from("drafts")
    .update({ status, last_pick_at: status === "live" ? new Date().toISOString() : undefined })
    .eq("id", str(formData, "draft_id"));
  revalidateLeague(str(formData, "slug"));
}

export async function makePickAction(
  draftId: string,
  userId: string,
  slug: string,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const supabase = await createClient();
  const { error } = await supabase.rpc("make_pick", {
    p_draft: draftId,
    p_user: userId,
  });
  if (error) return { error: error.message };
  revalidateLeague(slug);
  return { error: null };
}

export async function autoPickAction(
  draftId: string,
  slug: string,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const supabase = await createClient();
  const { error } = await supabase.rpc("auto_pick", { p_draft: draftId });
  if (error) return { error: error.message };
  revalidateLeague(slug);
  return { error: null };
}

export async function undoPickAction(formData: FormData) {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  await supabase.rpc("undo_last_pick", { p_draft: str(formData, "draft_id") });
  revalidateLeague(str(formData, "slug"));
}

export async function queueAdd(
  draftId: string,
  teamId: string,
  userId: string,
  rank: number,
  slug: string,
) {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  await supabase.from("draft_queues").upsert(
    { draft_id: draftId, team_id: teamId, user_id: userId, rank },
    { onConflict: "draft_id,team_id,user_id" },
  );
  revalidateLeague(slug);
}

export async function queueRemove(queueId: string, slug: string) {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  await supabase.from("draft_queues").delete().eq("id", queueId);
  revalidateLeague(slug);
}

/* ------------------------------- availability ------------------------------- */

export async function setAvailability(
  seasonId: string,
  timeSlotId: string,
  status: "yes" | "maybe" | "no",
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { error: "Not signed in" };
  const { error } = await supabase.from("availability").upsert(
    {
      user_id: userRes.user.id,
      season_id: seasonId,
      time_slot_id: timeSlotId,
      status,
    },
    { onConflict: "user_id,season_id,time_slot_id" },
  );
  return { error: error?.message ?? null };
}

export async function nudgeAvailability(formData: FormData) {
  if (!isSupabaseConfigured()) return;
  const seasonId = str(formData, "season_id");
  const leagueId = str(formData, "league_id");
  const slug = str(formData, "slug");
  const supabase = await createClient();
  const [{ data: members }, submitted] = await Promise.all([
    supabase
      .from("league_members")
      .select("user_id")
      .eq("league_id", leagueId)
      .eq("status", "active")
      .in("role", ["player", "captain"]),
    getSeasonAvailability(seasonId),
  ]);
  const done = new Set(submitted.map((a) => a.user_id));
  const missing = (members ?? [])
    .map((m) => m.user_id as string)
    .filter((u) => !done.has(u));
  if (missing.length > 0) {
    await supabase.from("notifications").insert(
      missing.map((user_id) => ({
        user_id,
        league_id: leagueId,
        category: "availability_nudge",
        title: "Fill out your availability",
        body: "Your captain needs to know when you can play.",
        link: `/league/${slug}/availability`,
      })),
    );
  }
}

/* -------------------------------- scheduling -------------------------------- */

export async function generateScheduleAction(
  _prev: ActionState & { conflicts?: { matchup: string; reason: string }[] },
  formData: FormData,
): Promise<ActionState & { conflicts?: { matchup: string; reason: string }[] }> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const seasonId = str(formData, "season_id");
  const slug = str(formData, "slug");
  const leagueId = str(formData, "league_id");
  const supabase = await createClient();

  const [{ data: seasonRow }, teams, availability] = await Promise.all([
    supabase.from("seasons").select("*").eq("id", seasonId).single(),
    getTeamsWithRosters(seasonId),
    getSeasonAvailability(seasonId),
  ]);
  if (!seasonRow) return { error: "Season not found." };
  const [{ data: slotRows }, { data: venueRows }] = await Promise.all([
    supabase.from("time_slots").select("*").eq("league_id", leagueId),
    supabase.from("venues").select("*").eq("league_id", leagueId),
  ]);
  const slots = (slotRows ?? []).map((s) => ({
    id: s.id as string,
    dayOfWeek: s.day_of_week as number,
    label: s.label as string,
  }));
  const venues = (venueRows ?? []).map((v) => ({
    id: v.id as string,
    splittable: Boolean(v.splittable),
  }));
  if (teams.length < 2) return { error: "Need at least two teams." };
  if (slots.length === 0) return { error: "Define time slots in the console first." };
  if (venues.length === 0) return { error: "Add a venue in the console first." };

  // availability[team][slot] = yes + 0.5×maybe, over rostered players
  const byUser = new Map<string, Map<string, string>>();
  for (const a of availability) {
    if (!byUser.has(a.user_id)) byUser.set(a.user_id, new Map());
    byUser.get(a.user_id)!.set(a.time_slot_id, a.status);
  }
  const availMatrix: Record<string, Record<string, number>> = {};
  for (const team of teams) {
    availMatrix[team.id] = {};
    for (const slot of slots) {
      let count = 0;
      for (const member of team.roster) {
        const s = byUser.get(member.user_id)?.get(slot.id);
        if (s === "yes") count += 1;
        else if (s === "maybe") count += 0.5;
      }
      availMatrix[team.id][slot.id] = Math.floor(count);
    }
  }

  const rules = (seasonRow.rules ?? {}) as {
    min_players_per_slot?: number;
    max_games_per_team_per_week?: number;
    matchups_per_pair?: number;
  };
  const result = generateSchedule({
    teams: teams.map((t) => t.id),
    weeks: seasonRow.num_weeks as number,
    slots,
    venues,
    availability: availMatrix,
    minPlayers: rules.min_players_per_slot ?? 4,
    maxGamesPerTeamPerWeek: rules.max_games_per_team_per_week ?? 1,
    matchupsPerPair: rules.matchups_per_pair ?? 1,
  });

  // regenerate: replace untouched scheduled regular-season games
  await supabase
    .from("games")
    .delete()
    .eq("season_id", seasonId)
    .eq("status", "scheduled")
    .eq("is_playoff", false);

  const slotById = new Map(slots.map((s) => [s.id, s]));
  if (result.games.length > 0) {
    const { error } = await supabase.from("games").insert(
      result.games.map((g) => ({
        season_id: seasonId,
        week: g.week,
        home_team_id: g.home,
        away_team_id: g.away,
        time_slot_id: g.slotId,
        venue_id: g.venueId,
        scheduled_date: slotDateFor(
          seasonRow.starts_on as string,
          g.week,
          slotById.get(g.slotId)?.dayOfWeek ?? 1,
        ),
      })),
    );
    if (error) return { error: error.message };
  }

  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  revalidateLeague(slug);
  return {
    error: null,
    notice: `Placed ${result.games.length} games.`,
    conflicts: result.conflicts.map((c) => ({
      matchup: `${teamName.get(c.matchup[0]) ?? c.matchup[0]} vs ${teamName.get(c.matchup[1]) ?? c.matchup[1]}`,
      reason: c.reason,
    })),
  };
}

export async function createGame(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const home = str(formData, "home_team_id");
  const away = str(formData, "away_team_id");
  if (!home || !away || home === away)
    return { error: "Pick two different teams." };
  const supabase = await createClient();
  const { error } = await supabase.from("games").insert({
    season_id: str(formData, "season_id"),
    week: parseInt(str(formData, "week") || "1", 10),
    home_team_id: home,
    away_team_id: away,
    time_slot_id: str(formData, "time_slot_id") || null,
    venue_id: str(formData, "venue_id") || null,
    scheduled_date: str(formData, "scheduled_date") || null,
  });
  if (error) return { error: error.message };
  revalidateLeague(str(formData, "slug"));
  return { error: null };
}

export async function rescheduleGame(formData: FormData) {
  if (!isSupabaseConfigured()) return;
  const gameId = str(formData, "game_id");
  const slug = str(formData, "slug");
  const supabase = await createClient();
  const { data: before } = await supabase
    .from("games")
    .select("home_team_id, away_team_id, scheduled_date, time_slot_id")
    .eq("id", gameId)
    .single();
  await supabase
    .from("games")
    .update({
      week: parseInt(str(formData, "week") || "1", 10),
      time_slot_id: str(formData, "time_slot_id") || null,
      venue_id: str(formData, "venue_id") || null,
      scheduled_date: str(formData, "scheduled_date") || null,
      status: str(formData, "status") || "scheduled",
    })
    .eq("id", gameId);
  if (before) {
    for (const team of [before.home_team_id, before.away_team_id]) {
      await supabase.rpc("notify_team", {
        p_team: team,
        p_category: "schedule_change",
        p_title: "Game rescheduled",
        p_body: "One of your games moved — check the new time.",
        p_link: `/league/${slug}/schedule`,
      });
    }
  }
  revalidateLeague(slug);
}

export async function deleteGame(formData: FormData) {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  await supabase
    .from("games")
    .delete()
    .eq("id", str(formData, "game_id"))
    .eq("status", "scheduled");
  revalidateLeague(str(formData, "slug"));
}

export async function setScorekeeper(formData: FormData) {
  if (!isSupabaseConfigured()) return;
  const gameId = str(formData, "game_id");
  const userId = str(formData, "user_id");
  const slug = str(formData, "slug");
  const leagueId = str(formData, "league_id");
  const supabase = await createClient();
  await supabase
    .from("games")
    .update({ scorekeeper_id: userId || null })
    .eq("id", gameId);
  if (userId) {
    await supabase.from("notifications").insert({
      user_id: userId,
      league_id: leagueId,
      category: "scorekeeper",
      title: "You're keeping book",
      body: "You've been assigned as scorekeeper for a game.",
      link: `/league/${slug}/game/${gameId}/live`,
    });
  }
  revalidateLeague(slug);
}

/* ---------------------------------- tracker --------------------------------- */

export interface TrackerEvent {
  seq: number;
  period: number;
  clock_ms: number | null;
  team_id: string | null;
  user_id: string | null;
  type: string;
  value: number | null;
  related_user_id: string | null;
  client_uuid: string;
}

export async function recordEvent(
  gameId: string,
  event: TrackerEvent,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { error: "Not signed in" };
  const { error } = await supabase.from("game_events").insert({
    game_id: gameId,
    ...event,
    created_by: userRes.user.id,
  });
  // duplicate client_uuid = already synced; treat as success
  if (error && !error.message.includes("duplicate")) return { error: error.message };
  return { error: null };
}

export async function voidEvent(
  gameId: string,
  eventId: string,
  voided: boolean,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const supabase = await createClient();
  const { error } = await supabase
    .from("game_events")
    .update({ voided })
    .eq("id", eventId)
    .eq("game_id", gameId);
  return { error: error?.message ?? null };
}

/** Void keyed by client_uuid — the console doesn't learn server ids for
    events it created itself, and this stays idempotent across retries. */
export async function voidEventByClientId(
  gameId: string,
  clientUuid: string,
  voided: boolean,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const supabase = await createClient();
  const { error } = await supabase
    .from("game_events")
    .update({ voided })
    .eq("game_id", gameId)
    .eq("client_uuid", clientUuid);
  return { error: error?.message ?? null };
}

export async function saveLineup(
  gameId: string,
  teamId: string,
  onCourt: string[],
  seq: number,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const supabase = await createClient();
  const { error } = await supabase.from("lineup_states").insert({
    game_id: gameId,
    team_id: teamId,
    on_court: onCourt,
    seq,
  });
  return { error: error?.message ?? null };
}

export async function setGameState(
  gameId: string,
  state: {
    status?: string;
    period?: number;
    clock_ms?: number | null;
    home_score?: number;
    away_score?: number;
  },
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const supabase = await createClient();
  const { error } = await supabase.from("games").update(state).eq("id", gameId);
  return { error: error?.message ?? null };
}

export async function finalizeGame(
  gameId: string,
  slug: string,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const supabase = await createClient();
  const [game, events, lineups] = await Promise.all([
    getGame(gameId),
    getGameEvents(gameId),
    getLineups(gameId),
  ]);
  if (!game) return { error: "Game not found." };

  const box = computeBoxScore(events, lineups, game.home_team_id, game.away_team_id);

  // per-player stat lines
  const rows = [...box.players.entries()].map(([userId, line]) => ({
    game_id: gameId,
    user_id: userId,
    team_id: line.team_id,
    pts: line.pts, fgm: line.fgm, fga: line.fga, tpm: line.tpm, tpa: line.tpa,
    ftm: line.ftm, fta: line.fta, oreb: line.oreb, dreb: line.dreb,
    reb: line.reb, ast: line.ast, stl: line.stl, blk: line.blk,
    tov: line.tov, pf: line.pf, plus_minus: line.plus_minus,
  }));
  if (rows.length > 0) {
    const { error } = await supabase
      .from("player_game_stats")
      .upsert(rows, { onConflict: "game_id,user_id" });
    if (error) return { error: error.message };
  }

  const { error: gameError } = await supabase
    .from("games")
    .update({
      status: "final",
      home_score: box.homeScore,
      away_score: box.awayScore,
    })
    .eq("id", gameId);
  if (gameError) return { error: gameError.message };

  // top scorer for the headline
  const top = rows.sort((a, b) => b.pts - a.pts)[0];
  let topName = "";
  if (top) {
    const { data: p } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", top.user_id)
      .maybeSingle();
    topName = p?.full_name ?? "";
  }
  const homeName = game.home_team?.name ?? "Home";
  const awayName = game.away_team?.name ?? "Away";
  const headline = `FINAL: ${homeName} ${box.homeScore}, ${awayName} ${box.awayScore}.${
    top && topName ? ` ${topName}: ${top.pts} pts, ${top.reb} reb.` : ""
  }`;

  for (const team of [game.home_team_id, game.away_team_id]) {
    await supabase.rpc("notify_team", {
      p_team: team,
      p_category: "final_score",
      p_title: "Final score",
      p_body: headline,
      p_link: `/league/${slug}/game/${gameId}`,
    });
  }
  const { data: seasonRow } = await supabase
    .from("seasons")
    .select("league_id")
    .eq("id", game.season_id)
    .single();
  if (seasonRow) {
    await supabase.rpc("post_auto", {
      p_league: seasonRow.league_id,
      p_season: game.season_id,
      p_body: headline,
      p_meta: { game_id: gameId },
    });
  }

  if (game.is_playoff && game.bracket_node_id) {
    await advanceBracketAfterFinal(game.season_id, game.bracket_node_id, {
      winner:
        box.homeScore >= box.awayScore ? game.home_team_id : game.away_team_id,
    });
  }

  revalidateLeague(slug);
  return { error: null };
}

/* --------------------------------- playoffs --------------------------------- */

async function advanceBracketAfterFinal(
  seasonId: string,
  nodeId: string,
  { winner }: { winner: string },
) {
  const supabase = await createClient();
  await supabase
    .from("bracket_nodes")
    .update({ winner_team_id: winner })
    .eq("id", nodeId);

  const { data: season } = await supabase
    .from("seasons")
    .select("num_weeks, playoff_format, league_id")
    .eq("id", seasonId)
    .single();
  const seeds: string[] =
    (season?.playoff_format as { seeds?: string[] })?.seeds ?? [];

  const { data: nodes } = await supabase
    .from("bracket_nodes")
    .select("*")
    .eq("season_id", seasonId);
  const byId = new Map((nodes ?? []).map((n) => [n.id as string, n]));

  const resolveSource = (src: string): string | null => {
    if (src.startsWith("seed:")) return seeds[parseInt(src.slice(5), 10) - 1] ?? null;
    if (src.startsWith("winner:")) {
      const n = byId.get(src.slice(7));
      return (n?.winner_team_id as string | null) ?? null;
    }
    return null;
  };

  const nextNodes = (nodes ?? []).filter(
    (n) =>
      n.home_source === `winner:${nodeId}` || n.away_source === `winner:${nodeId}`,
  );
  for (const next of nextNodes) {
    const home = resolveSource(next.home_source as string);
    const away = resolveSource(next.away_source as string);
    if (home && away && !next.game_id) {
      const { data: g } = await supabase
        .from("games")
        .insert({
          season_id: seasonId,
          week: (season?.num_weeks ?? 0) + (next.round as number),
          home_team_id: home,
          away_team_id: away,
          is_playoff: true,
          bracket_node_id: next.id,
        })
        .select("id")
        .single();
      if (g) {
        await supabase
          .from("bracket_nodes")
          .update({ game_id: g.id })
          .eq("id", next.id);
      }
    }
  }

  // championship decided?
  const maxRound = Math.max(...(nodes ?? []).map((n) => n.round as number));
  const finalNode = (nodes ?? []).find(
    (n) => (n.round as number) === maxRound,
  );
  if (finalNode && finalNode.id === nodeId && season) {
    await supabase
      .from("seasons")
      .update({ status: "complete" })
      .eq("id", seasonId);
    const { data: champ } = await supabase
      .from("teams")
      .select("name")
      .eq("id", winner)
      .single();
    await supabase.rpc("post_auto", {
      p_league: season.league_id,
      p_season: seasonId,
      p_body: `${champ?.name ?? "Champions"} win the championship.`,
      p_meta: { champion_team_id: winner },
    });
    await supabase
      .from("awards")
      .delete()
      .eq("season_id", seasonId)
      .eq("kind", "champion");
    await supabase.from("awards").insert({
      season_id: seasonId,
      kind: "champion",
      team_id: winner,
      is_auto: true,
    });
  }
}

export async function generateBracketAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const seasonId = str(formData, "season_id");
  const slug = str(formData, "slug");
  const numTeams = parseInt(str(formData, "num_teams") || "4", 10);
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("bracket_nodes")
    .select("id")
    .eq("season_id", seasonId)
    .limit(1);
  if ((existing ?? []).length > 0)
    return { error: "A bracket already exists for this season." };

  const [teams, { data: gameRows }] = await Promise.all([
    getTeams(seasonId),
    supabase
      .from("games")
      .select("home_team_id, away_team_id, home_score, away_score, status")
      .eq("season_id", seasonId)
      .eq("is_playoff", false),
  ]);
  if (teams.length < 2) return { error: "Not enough teams." };
  const { standings } = computeStandings(
    teams.map((t) => t.id),
    (gameRows ?? []) as {
      home_team_id: string; away_team_id: string;
      home_score: number; away_score: number; status: string;
    }[],
  );
  const seeds = standings.slice(0, Math.min(numTeams, teams.length)).map((s) => s.teamId);

  const plan = buildBracket(seeds.length);
  // insert round by round so winner: sources can reference real uuids
  const idByKey = new Map<string, string>();
  for (const node of plan.sort((a, b) => a.round - b.round || a.position - b.position)) {
    const translate = (src: string) =>
      src.startsWith("winner:") ? `winner:${idByKey.get(src.slice(7))}` : src;
    const { data: inserted, error } = await supabase
      .from("bracket_nodes")
      .insert({
        season_id: seasonId,
        round: node.round,
        position: node.position,
        home_source: translate(node.homeSource),
        away_source: translate(node.awaySource),
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    idByKey.set(`${node.round}-${node.position}`, inserted.id);
  }

  // resolve byes + create round-1 games
  const { data: nodes } = await supabase
    .from("bracket_nodes")
    .select("*")
    .eq("season_id", seasonId)
    .eq("round", 1);
  const { data: season } = await supabase
    .from("seasons")
    .select("num_weeks")
    .eq("id", seasonId)
    .single();
  for (const node of nodes ?? []) {
    const home = (node.home_source as string).startsWith("seed:")
      ? seeds[parseInt((node.home_source as string).slice(5), 10) - 1]
      : null;
    const away = (node.away_source as string).startsWith("seed:")
      ? seeds[parseInt((node.away_source as string).slice(5), 10) - 1]
      : null;
    if (home && away) {
      const { data: g } = await supabase
        .from("games")
        .insert({
          season_id: seasonId,
          week: (season?.num_weeks ?? 0) + 1,
          home_team_id: home,
          away_team_id: away,
          is_playoff: true,
          bracket_node_id: node.id,
        })
        .select("id")
        .single();
      if (g)
        await supabase.from("bracket_nodes").update({ game_id: g.id }).eq("id", node.id);
    } else if (home || away) {
      // bye — auto-advance, then propagate (may create round-2 games)
      await advanceBracketAfterFinal(seasonId, node.id as string, {
        winner: (home ?? away)!,
      });
    }
  }

  await supabase
    .from("seasons")
    .update({
      status: "playoffs",
      playoff_format: { type: "single_elim", seeds },
    })
    .eq("id", seasonId);

  revalidateLeague(slug);
  return { error: null, notice: `Bracket created with ${seeds.length} teams.` };
}

/* ----------------------------------- feed ----------------------------------- */

export async function postAnnouncement(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const body = str(formData, "body");
  if (!body) return { error: "Write something first." };
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { error: "Not signed in" };
  const teamId = str(formData, "team_id");
  const { error } = await supabase.from("posts").insert({
    league_id: str(formData, "league_id"),
    season_id: str(formData, "season_id") || null,
    author_id: userRes.user.id,
    team_id: teamId || null,
    kind: teamId ? "team" : "announcement",
    body,
  });
  if (error) return { error: error.message };
  revalidateLeague(str(formData, "slug"));
  return { error: null };
}

/* --------------------------------- trades ---------------------------------- */

export async function proposeTradeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const offer = formData.getAll("offer").map(String).filter(Boolean);
  const request = formData.getAll("request").map(String).filter(Boolean);
  if (offer.length === 0 || request.length === 0)
    return { error: "Select players on both sides." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("propose_trade", {
    p_season: str(formData, "season_id"),
    p_from_team: str(formData, "from_team_id"),
    p_to_team: str(formData, "to_team_id"),
    p_offer: offer,
    p_request: request,
    p_note: str(formData, "note"),
  });
  if (error) return { error: error.message };
  revalidateLeague(str(formData, "slug"));
  return { error: null, notice: "Trade proposed." };
}

export async function respondTradeAction(formData: FormData) {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  await supabase.rpc("respond_trade", {
    p_trade: str(formData, "trade_id"),
    p_accept: str(formData, "accept") === "true",
  });
  revalidateLeague(str(formData, "slug"));
}

export async function resolveTradeAction(formData: FormData) {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  await supabase.rpc("resolve_trade", {
    p_trade: str(formData, "trade_id"),
    p_approve: str(formData, "approve") === "true",
  });
  revalidateLeague(str(formData, "slug"));
}

export async function cancelTradeAction(formData: FormData) {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  await supabase.rpc("cancel_trade", { p_trade: str(formData, "trade_id") });
  revalidateLeague(str(formData, "slug"));
}

/* ---------------------------------- rules ----------------------------------- */

export async function saveRules(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { error: "Not signed in" };
  const { error } = await supabase.from("league_rules").upsert(
    {
      league_id: str(formData, "league_id"),
      content: String(formData.get("content") ?? ""),
      updated_by: userRes.user.id,
    },
    { onConflict: "league_id" },
  );
  if (error) return { error: error.message };
  revalidateLeague(str(formData, "slug"));
  return { error: null, notice: "Rules saved." };
}

const MAX_RULE_FILE_BYTES = 10 * 1024 * 1024;

export async function uploadRuleFile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const leagueId = str(formData, "league_id");
  const slug = str(formData, "slug");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file first." };
  }
  if (file.size > MAX_RULE_FILE_BYTES) {
    return { error: "That file is over 10 MB. Upload a smaller one." };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { error: "Not signed in" };

  const safeName = file.name.replace(/[^\w.\-() ]+/g, "_").slice(0, 120);
  const storagePath = `${leagueId}/${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from("rules")
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
    });
  if (uploadError) return { error: uploadError.message };

  const { error } = await supabase.from("rule_files").insert({
    league_id: leagueId,
    name: safeName,
    storage_path: storagePath,
    size_bytes: file.size,
    uploaded_by: userRes.user.id,
  });
  if (error) {
    // don't leave an orphaned blob behind
    await supabase.storage.from("rules").remove([storagePath]);
    return { error: error.message };
  }
  revalidateLeague(slug);
  return { error: null, notice: `Uploaded ${safeName}.` };
}

export async function deleteRuleFile(formData: FormData) {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  const fileId = str(formData, "file_id");
  const { data: file } = await supabase
    .from("rule_files")
    .select("storage_path")
    .eq("id", fileId)
    .maybeSingle();
  if (!file) return;
  await supabase.storage.from("rules").remove([file.storage_path]);
  await supabase.from("rule_files").delete().eq("id", fileId);
  revalidateLeague(str(formData, "slug"));
}

/* ------------------------------ notifications ------------------------------- */

export async function markAllNotificationsRead() {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  revalidatePath("/inbox");
}
