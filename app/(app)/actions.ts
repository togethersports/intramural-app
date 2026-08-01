"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  DEMO_LEAGUE_NAME,
  DEMO_ORG_NAME,
  DEMO_PLAYOFF_TEAMS,
  DEMO_REGULAR_SEASON_WEEKS,
  DEMO_RULES,
  DEMO_SEASON_RULES,
  DEMO_SLOTS,
  DEMO_TEAMS,
  DEMO_VENUES,
  GHOST_PLAYERS,
  JERSEY_NUMBERS,
  distributeRoster,
  type GhostPlayer,
} from "@/lib/demo-league";
import { buildBracket } from "@core/bracket";
import {
  breakTie,
  buildFixtures,
  expandLineToEvents,
  makeRng,
  statLine,
} from "@core/demo-fixtures";
import { computeStandings, type GameResult } from "@core/standings";

export type ActionState = { error: string | null };

const NOT_CONFIGURED =
  "The backend isn't connected yet. Add your Supabase keys — see the Setup page.";

export async function createLeague(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const name = String(formData.get("name") ?? "").trim();
  const sport = String(formData.get("sport") ?? "basketball");
  const color = String(formData.get("color") ?? "#c8232c");
  const orgName = String(formData.get("org_name") ?? "").trim();

  if (name.length < 3)
    return { error: "League name must be at least 3 characters." };

  const supabase = await createClient();
  const { data: slug, error } = await supabase.rpc("create_league", {
    p_name: name,
    p_sport: sport,
    p_color: color,
    p_org_name: orgName || null,
  });
  if (error) return { error: error.message };
  redirect(`/league/${slug}`);
}

export async function joinLeague(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const code = String(formData.get("code") ?? "").trim();
  if (code.length < 6) return { error: "Join codes are 6 characters." };

  const supabase = await createClient();
  const { data: slug, error } = await supabase.rpc("join_league_with_code", {
    p_code: code,
  });
  if (error) return { error: error.message };
  redirect(`/league/${slug}`);
}

/* ------------------------------- demo league -------------------------------
   Populates a full, playable league in one click: 8 teams, 60 rostered
   ghost players, a completed 9-week schedule with reconciled box scores,
   two executed trades, and a live 4-team playoff bracket with one game
   actually in progress. See lib/demo-league.ts for the content and
   scripts/seed-ghost-players.mjs for how the 60 ghost accounts get created
   (once, out of band — this action only ever references their fixed ids).

   Every write here runs under the signed-in commissioner's own session —
   no service role, no elevated access beyond what two narrow, is_demo-
   gated RPCs grant (migration 0011) for the two tables that have no other
   client-write path at all: league_members and trades. */

function iso(base: Date, offsetDays: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export async function loadDemoLeague(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { error: "Not signed in" };
  const commissionerId = userRes.user.id;

  let leagueId: string | null = null;
  let leagueSlug: string | null = null;
  try {
    const { data: slug, error: createError } = await supabase.rpc("create_league", {
      p_name: DEMO_LEAGUE_NAME,
      p_sport: "basketball",
      p_color: DEMO_TEAMS[0].color,
      p_org_name: DEMO_ORG_NAME,
    });
    if (createError) throw new Error(createError.message);

    const { data: league, error: leagueError } = await supabase
      .from("leagues")
      .select("id")
      .eq("slug", slug)
      .single();
    if (leagueError || !league) throw new Error(leagueError?.message ?? "League not found after creation.");
    leagueId = league.id as string;
    leagueSlug = slug as string;

    const { error: flagError } = await supabase
      .from("leagues")
      .update({ is_demo: true })
      .eq("id", leagueId);
    if (flagError) throw new Error(flagError.message);

    const { error: rosterRpcError } = await supabase.rpc("seed_demo_roster", {
      p_league: leagueId,
      p_user_ids: GHOST_PLAYERS.map((p) => p.id),
    });
    if (rosterRpcError) throw new Error(rosterRpcError.message);

    const { error: rulesError } = await supabase.from("league_rules").insert({
      league_id: leagueId,
      content: DEMO_RULES,
      updated_by: commissionerId,
    });
    if (rulesError) throw new Error(rulesError.message);

    const { data: venues, error: venueError } = await supabase
      .from("venues")
      .insert(DEMO_VENUES.map((v) => ({ ...v, league_id: leagueId })))
      .select("id");
    if (venueError || !venues) throw new Error(venueError?.message ?? "Venues failed.");

    const { data: slots, error: slotError } = await supabase
      .from("time_slots")
      .insert(DEMO_SLOTS.map((s) => ({ ...s, league_id: leagueId })))
      .select("id");
    if (slotError || !slots) throw new Error(slotError?.message ?? "Time slots failed.");

    const seasonStart = new Date();
    seasonStart.setDate(seasonStart.getDate() - DEMO_REGULAR_SEASON_WEEKS * 7);
    const seasonEnd = new Date();
    seasonEnd.setDate(seasonEnd.getDate() + 21); // playoff margin

    const { data: season, error: seasonError } = await supabase
      .from("seasons")
      .insert({
        league_id: leagueId,
        name: "Demo Season",
        starts_on: iso(seasonStart, 0),
        ends_on: iso(seasonEnd, 0),
        num_weeks: DEMO_REGULAR_SEASON_WEEKS,
        status: "active",
        rules: DEMO_SEASON_RULES,
      })
      .select()
      .single();
    if (seasonError || !season) throw new Error(seasonError?.message ?? "Season failed.");

    const { data: teams, error: teamsError } = await supabase
      .from("teams")
      .insert(DEMO_TEAMS.map((t) => ({ ...t, season_id: season.id })))
      .select("id, name, color");
    if (teamsError || !teams) throw new Error(teamsError?.message ?? "Teams failed.");

    const rosters = distributeRoster(GHOST_PLAYERS, teams.length);
    const memberships = rosters.flatMap((roster, t) =>
      roster.map((p, j) => ({
        team_id: teams[t].id as string,
        user_id: p.id,
        jersey_number: JERSEY_NUMBERS[j] ?? 40 + j,
        is_captain: j === 0,
      })),
    );
    const { error: rosterError } = await supabase.from("team_members").insert(memberships);
    if (rosterError) throw new Error(rosterError.message);

    const captainIds = rosters.map((r) => r[0].id);
    await Promise.all(
      teams.map((t, i) =>
        supabase.from("teams").update({ captain_id: captainIds[i] }).eq("id", t.id as string),
      ),
    );
    const { error: captainRoleError } = await supabase
      .from("league_members")
      .update({ role: "captain" })
      .eq("league_id", leagueId)
      .in("user_id", captainIds);
    if (captainRoleError) throw new Error(captainRoleError.message);

    // ------------------------------------------------------------ schedule
    const rnd = makeRng(Math.floor(Math.random() * 2 ** 31));
    const fixtures = buildFixtures(teams.length, DEMO_REGULAR_SEASON_WEEKS);

    type Line = ReturnType<typeof statLine> & { userId: string; teamId: string };
    const gameRows: {
      season_id: string; week: number; home_team_id: string; away_team_id: string;
      venue_id: string; time_slot_id: string; scheduled_date: string;
      status: string; home_score: number; away_score: number; period: number;
      scorekeeper_id: string;
    }[] = [];
    const statsByKey = new Map<string, { home: Line[]; away: Line[] }>();

    fixtures.forEach((f) => {
      const homeTeam = teams[f.homeIndex];
      const awayTeam = teams[f.awayIndex];
      const homeRoster = rosters[f.homeIndex];
      const awayRoster = rosters[f.awayIndex];
      const homeLines: Line[] = homeRoster.map((p, j) => ({
        ...statLine(rnd, { star: j === 0 }),
        userId: p.id,
        teamId: homeTeam.id as string,
      }));
      const awayLines: Line[] = awayRoster.map((p, j) => ({
        ...statLine(rnd, { star: j === 0 }),
        userId: p.id,
        teamId: awayTeam.id as string,
      }));
      let homeScore = homeLines.reduce((s, l) => s + l.pts, 0);
      const awayScore = awayLines.reduce((s, l) => s + l.pts, 0);
      if (homeScore === awayScore) homeScore = breakTie(homeLines, homeScore);
      const margin = homeScore - awayScore;
      const jitter = () => Math.round((rnd() - 0.5) * 8);
      homeLines.forEach((l) => (l.plus_minus = margin + jitter()));
      awayLines.forEach((l) => (l.plus_minus = -margin + jitter()));

      const key = `${f.week}-${homeTeam.id}-${awayTeam.id}`;
      statsByKey.set(key, { home: homeLines, away: awayLines });
      gameRows.push({
        season_id: season.id as string,
        week: f.week,
        home_team_id: homeTeam.id as string,
        away_team_id: awayTeam.id as string,
        venue_id: venues[f.gameOfWeek % venues.length].id as string,
        time_slot_id: slots[(f.week + f.gameOfWeek) % slots.length].id as string,
        scheduled_date: iso(seasonStart, (f.week - 1) * 7 + f.gameOfWeek),
        status: "final",
        home_score: homeScore,
        away_score: awayScore,
        period: DEMO_SEASON_RULES.periods,
        scorekeeper_id: commissionerId,
      });
    });

    const { data: insertedGames, error: gamesError } = await supabase
      .from("games")
      .insert(gameRows)
      .select("id, week, home_team_id, away_team_id");
    if (gamesError || !insertedGames) throw new Error(gamesError?.message ?? "Games failed.");

    const statRows = insertedGames.flatMap((g) => {
      const key = `${g.week}-${g.home_team_id}-${g.away_team_id}`;
      const lines = statsByKey.get(key);
      if (!lines) return [];
      return [...lines.home, ...lines.away].map((l) => ({
        game_id: g.id as string,
        user_id: l.userId,
        team_id: l.teamId,
        pts: l.pts, fgm: l.fgm, fga: l.fga, tpm: l.tpm, tpa: l.tpa,
        ftm: l.ftm, fta: l.fta, oreb: l.oreb, dreb: l.dreb, reb: l.reb,
        ast: l.ast, stl: l.stl, blk: l.blk, tov: l.tov, pf: l.pf,
        plus_minus: l.plus_minus, minutes: l.minutes,
      }));
    });
    const { error: statsError } = await supabase.from("player_game_stats").insert(statRows);
    if (statsError) throw new Error(statsError.message);

    // ------------------------------------------------------------- playoffs
    const standingsInput: GameResult[] = gameRows.map((g) => ({
      home_team_id: g.home_team_id, away_team_id: g.away_team_id,
      home_score: g.home_score, away_score: g.away_score, status: g.status,
    }));
    const { standings } = computeStandings(
      teams.map((t) => t.id as string),
      standingsInput,
    );
    const seeds = standings.slice(0, DEMO_PLAYOFF_TEAMS).map((s) => s.teamId);
    const plan = buildBracket(seeds.length); // 4 seeds = 2 rounds, no byes

    const idByKey = new Map<string, string>();
    for (const node of [...plan].sort((a, b) => a.round - b.round || a.position - b.position)) {
      const translate = (src: string) =>
        src.startsWith("winner:") ? `winner:${idByKey.get(src.slice(7))}` : src;
      const { data: inserted, error: nodeError } = await supabase
        .from("bracket_nodes")
        .insert({
          season_id: season.id,
          round: node.round,
          position: node.position,
          home_source: translate(node.homeSource),
          away_source: translate(node.awaySource),
        })
        .select("id")
        .single();
      if (nodeError || !inserted) throw new Error(nodeError?.message ?? "Bracket node failed.");
      idByKey.set(`${node.round}-${node.position}`, inserted.id as string);
    }

    const round1 = plan.filter((n) => n.round === 1);
    const seedTeam = (src: string) =>
      src.startsWith("seed:") ? seeds[parseInt(src.slice(5), 10) - 1] : null;
    const teamById = new Map(teams.map((t) => [t.id as string, t]));
    const rosterByTeamId = new Map(teams.map((t, i) => [t.id as string, rosters[i]]));

    for (const [i, node] of round1.entries()) {
      const homeTeamId = seedTeam(node.homeSource)!;
      const awayTeamId = seedTeam(node.awaySource)!;
      const nodeId = idByKey.get(`${node.round}-${node.position}`)!;
      const live = i === 0; // one showcase game, actually in progress

      if (!live) {
        const { data: g, error: gErr } = await supabase
          .from("games")
          .insert({
            season_id: season.id,
            week: DEMO_REGULAR_SEASON_WEEKS + 1,
            home_team_id: homeTeamId,
            away_team_id: awayTeamId,
            is_playoff: true,
            bracket_node_id: nodeId,
            scorekeeper_id: commissionerId,
          })
          .select("id")
          .single();
        if (gErr || !g) throw new Error(gErr?.message ?? "Playoff game failed.");
        const { error: linkErr } = await supabase
          .from("bracket_nodes")
          .update({ game_id: g.id })
          .eq("id", nodeId);
        if (linkErr) throw new Error(linkErr.message);
        continue;
      }

      // ---- the one live playoff game: a real, replayable event stream ----
      const periodMs = DEMO_SEASON_RULES.period_minutes * 60_000;
      const homeRoster = rosterByTeamId.get(homeTeamId)!.slice(0, 5);
      const awayRoster = rosterByTeamId.get(awayTeamId)!.slice(0, 5);
      const linesFor = (roster: GhostPlayer[], teamId: string) =>
        roster.map((p, j) => ({
          ...statLine(rnd, { star: j === 0, scale: 0.4 }),
          userId: p.id,
          teamId,
        }));
      const homeLive = linesFor(homeRoster, homeTeamId);
      const awayLive = linesFor(awayRoster, awayTeamId);
      const liveHomeScore = homeLive.reduce((s, l) => s + l.pts, 0);
      const liveAwayScore = awayLive.reduce((s, l) => s + l.pts, 0);

      const { data: liveGame, error: liveGameError } = await supabase
        .from("games")
        .insert({
          season_id: season.id,
          week: DEMO_REGULAR_SEASON_WEEKS + 1,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          is_playoff: true,
          bracket_node_id: nodeId,
          status: "live",
          period: 2,
          clock_ms: Math.floor(rnd() * periodMs),
          home_score: liveHomeScore,
          away_score: liveAwayScore,
          scorekeeper_id: commissionerId,
        })
        .select("id")
        .single();
      if (liveGameError || !liveGame) throw new Error(liveGameError?.message ?? "Live game failed.");
      const { error: liveLinkErr } = await supabase
        .from("bracket_nodes")
        .update({ game_id: liveGame.id })
        .eq("id", nodeId);
      if (liveLinkErr) throw new Error(liveLinkErr.message);

      const { error: lineupError } = await supabase.from("lineup_states").insert([
        { game_id: liveGame.id, seq: 0, team_id: homeTeamId, on_court: homeRoster.map((p) => p.id) },
        { game_id: liveGame.id, seq: 0, team_id: awayTeamId, on_court: awayRoster.map((p) => p.id) },
      ]);
      if (lineupError) throw new Error(lineupError.message);

      const rawEvents = [...homeLive, ...awayLive].flatMap((l) =>
        expandLineToEvents(rnd, l, 2, periodMs).map((e) => ({ ...e, userId: l.userId, teamId: l.teamId })),
      );
      rawEvents.sort((a, b) => a.period - b.period || b.clockMs - a.clockMs);
      const eventRows = rawEvents.map((e, i2) => ({
        game_id: liveGame.id,
        seq: i2 + 1,
        period: e.period,
        clock_ms: e.clockMs,
        team_id: e.teamId,
        user_id: e.userId,
        type: e.type,
        value: e.type === "fg3_made" ? 3 : e.type === "fg2_made" ? 2 : e.type === "ft_made" ? 1 : null,
        created_by: commissionerId,
        client_uuid: randomUUID(),
      }));
      const { error: eventsError } = await supabase.from("game_events").insert(eventRows);
      if (eventsError) throw new Error(eventsError.message);

      await supabase.from("notifications").insert({
        user_id: commissionerId,
        league_id: leagueId,
        category: "scorekeeper",
        title: "You're keeping score",
        body: `${teamById.get(homeTeamId)?.name} vs ${teamById.get(awayTeamId)?.name} is live in the playoffs.`,
        link: `/league/${slug}/game/${liveGame.id}/live`,
      });
    }

    const { error: seasonStatusError } = await supabase
      .from("seasons")
      .update({ status: "playoffs", playoff_format: { type: "single_elim", seeds } })
      .eq("id", season.id);
    if (seasonStatusError) throw new Error(seasonStatusError.message);

    // --------------------------------------------------------------- trades
    const tradePairs: [number, number, number[], number[]][] = [
      [0, 1, [2], [2]],
      [2, 3, [3, 4], [3]],
    ];
    for (const [fromIdx, toIdx, offerIdx, requestIdx] of tradePairs) {
      const fromRoster = rosters[fromIdx];
      const toRoster = rosters[toIdx];
      const offer = offerIdx.filter((i) => i < fromRoster.length).map((i) => fromRoster[i].id);
      const request = requestIdx.filter((i) => i < toRoster.length).map((i) => toRoster[i].id);
      if (offer.length === 0 || request.length === 0) continue;
      const { error: tradeError } = await supabase.rpc("seed_demo_trade", {
        p_season: season.id,
        p_from_team: teams[fromIdx].id,
        p_to_team: teams[toIdx].id,
        p_offer: offer,
        p_request: request,
      });
      if (tradeError) throw new Error(tradeError.message);
    }

    revalidatePath("/dashboard");
    revalidatePath("/leagues/new");
  } catch (err) {
    // best-effort cleanup — don't leave a half-built demo league behind
    if (leagueId) await supabase.from("leagues").delete().eq("id", leagueId);
    return { error: err instanceof Error ? err.message : "Failed to build the demo league." };
  }

  // redirect() throws internally — it must stay outside the try/catch above,
  // or this function's own catch would treat that throw as a real failure
  // and delete the league it just successfully built.
  if (!leagueSlug) return { error: "The demo league was built but its address got lost." };
  redirect(`/league/${leagueSlug}`);
}

/** Verifies is_demo before deleting — the RLS commissioner-delete policy
    would allow a real league too, so this is the guard that keeps the
    "reset demo league" button from ever being pointed at real data. */
export async function resetDemoLeague(formData: FormData) {
  if (!isSupabaseConfigured()) return;
  const leagueId = String(formData.get("league_id") ?? "");
  if (!leagueId) return;
  const supabase = await createClient();
  const { data: league } = await supabase
    .from("leagues")
    .select("is_demo")
    .eq("id", leagueId)
    .maybeSingle();
  if (!league?.is_demo) return;
  await supabase.from("leagues").delete().eq("id", leagueId);
  redirect("/dashboard");
}

/* ------------------------------ league lifecycle -----------------------------
   Archive: out of the active list, everything kept, reversible any time.
   Delete: soft, with a 30-day recovery window surfaced on the dashboard's
   Archived section, then purged (cascade) by purge_expired_leagues().
   RLS enforces who may flip these flags — only the commissioner can update
   a leagues row at all. */

export async function archiveLeague(formData: FormData) {
  if (!isSupabaseConfigured()) return;
  const leagueId = String(formData.get("league_id") ?? "");
  if (!leagueId) return;
  const supabase = await createClient();
  const { data } = await supabase
    .from("leagues")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", leagueId)
    .select("name")
    .maybeSingle();
  if (!data) return; // RLS refused — not the commissioner
  revalidatePath("/dashboard");
  redirect(`/dashboard?notice=${encodeURIComponent(`${data.name} archived.`)}`);
}

export async function unarchiveLeague(formData: FormData) {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  await supabase
    .from("leagues")
    .update({ archived_at: null })
    .eq("id", String(formData.get("league_id") ?? ""));
  revalidatePath("/dashboard");
}

export async function restoreLeague(formData: FormData) {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  const { data } = await supabase
    .from("leagues")
    .update({ deleted_at: null })
    .eq("id", String(formData.get("league_id") ?? ""))
    .select("name")
    .maybeSingle();
  revalidatePath("/dashboard");
  if (data) {
    redirect(`/dashboard?notice=${encodeURIComponent(`${data.name} restored.`)}`);
  }
}

/** Typed-name confirmation happens client-side for feedback, but the server
    re-verifies it — the destructive action never trusts the client. */
export async function deleteLeagueAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const leagueId = String(formData.get("league_id") ?? "");
  const typed = String(formData.get("confirm_name") ?? "").trim();
  const supabase = await createClient();
  const { data: league } = await supabase
    .from("leagues")
    .select("name")
    .eq("id", leagueId)
    .maybeSingle();
  if (!league) return { error: "League not found." };
  if (typed !== league.name)
    return { error: `Type the league name exactly — "${league.name}" — to confirm.` };
  const { data: updated, error } = await supabase
    .from("leagues")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", leagueId)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!updated) return { error: "Only the commissioner can delete a league." };
  revalidatePath("/dashboard");
  redirect(
    `/dashboard?notice=${encodeURIComponent(
      `${league.name} deleted. You can restore it for 30 days from the Archived section below.`,
    )}`,
  );
}

export async function updateMemberRole(formData: FormData) {
  if (!isSupabaseConfigured()) return;
  const memberId = String(formData.get("member_id") ?? "");
  const role = String(formData.get("role") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const allowed = ["admin", "captain", "player", "spectator"];
  if (!memberId || !allowed.includes(role)) return;

  const supabase = await createClient();
  // RLS: only commissioners/admins can update, and admins can't touch
  // the commissioner's row or grant the commissioner role.
  await supabase.from("league_members").update({ role }).eq("id", memberId);
  revalidatePath(`/league/${slug}/members`);
}

export async function removeMember(formData: FormData) {
  if (!isSupabaseConfigured()) return;
  const memberId = String(formData.get("member_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!memberId) return;

  const supabase = await createClient();
  await supabase
    .from("league_members")
    .update({ status: "removed" })
    .eq("id", memberId);
  revalidatePath(`/league/${slug}/members`);
}
