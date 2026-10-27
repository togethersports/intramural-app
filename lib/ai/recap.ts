import { createClient } from "@/lib/supabase/server";
import { write } from "@/lib/ai/write";
import {
  buildRecapLines,
  fallbackRecap,
  playByPlay,
  recapFacts,
  summarizeFlow,
  type RecapInput,
} from "@core/recap-input";
import type { GameEventRow, PlayerGameStatRow } from "@core/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Write (and store) the recap for a finished game.
 *
 * Called once, when the game finalizes. Everything numeric is computed from
 * the materialized box score and the event log first; the model only turns
 * those facts into sentences. If it can't, the same facts get assembled into
 * plainer prose — either way the game page has a recap.
 *
 * Idempotent by the unique index on `game_recaps.game_id`: re-finalizing, or
 * a retried request, updates the row rather than stacking recaps.
 */
export async function generateGameRecap(
  gameId: string,
  client?: SupabaseClient,
): Promise<{
  ok: boolean;
  source: "claude" | "fallback" | "skipped";
  detail: string;
  /** Why the model didn't write it, when it didn't. */
  reason?: string;
}> {
  const supabase = client ?? (await createClient());

  const { data: game } = await supabase
    .from("games")
    .select(
      "id, season_id, week, is_playoff, status, home_score, away_score, home_team_id, away_team_id, venue:venues(name), time_slot:time_slots(label)",
    )
    .eq("id", gameId)
    .maybeSingle();

  if (!game) return { ok: false, source: "skipped", detail: "Game not found." };
  if (game.status !== "final" && game.status !== "forfeit") {
    return { ok: false, source: "skipped", detail: `Game is ${game.status}, not final.` };
  }

  const [{ data: teams }, { data: stats }, { data: events }, { data: subs }] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, abbrev")
      .in("id", [game.home_team_id, game.away_team_id]),
    supabase
      .from("player_game_stats")
      .select("*, profile:profiles(full_name)")
      .eq("game_id", gameId),
    supabase
      .from("game_events")
      .select(
        "id, seq, period, clock_ms, user_id, guest_id, team_id, type, value, related_user_id, voided, client_uuid",
      )
      .eq("game_id", gameId)
      .order("seq"),
    // Subs from other teams: the recap should say who they really play for.
    supabase
      .from("sub_requests")
      .select("id, fill_user_id, fill:profiles!sub_requests_fill_user_id_fkey(full_name)")
      .eq("game_id", gameId)
      .eq("status", "approved")
      .not("fill_user_id", "is", null),
  ]);

  const teamById = new Map(
    (teams ?? []).map((t) => [t.id as string, { name: t.name as string, abbrev: t.abbrev as string }]),
  );

  // Guests carry no profile row, so their names come off the game itself.
  const { data: guests } = await supabase
    .from("game_guests")
    .select("id, display_name")
    .eq("game_id", gameId);

  const nameOf = new Map<string, string>();
  for (const g of guests ?? []) {
    nameOf.set(g.id as string, g.display_name as string);
  }
  const statRows = (stats ?? []) as (PlayerGameStatRow & {
    profile?: { full_name: string } | null;
  })[];
  for (const s of statRows) {
    const key = (s.user_id ?? s.guest_id) as string | null;
    if (key && s.profile?.full_name) nameOf.set(key, s.profile.full_name);
  }

  // A sub's line is keyed by their user id, or — when the commissioner chose
  // not to count it — by the sub request's id, stored as a one-game guest.
  // Their plays are under their user id either way, so name both keys.
  const subFromOf = new Map<string, string>();
  const subRows = subs ?? [];
  if (subRows.length > 0) {
    const { data: rostered } = await supabase
      .from("team_members")
      .select("user_id, team:teams!inner(name, season_id)")
      .in("user_id", subRows.map((r) => r.fill_user_id as string))
      .is("left_at", null)
      .eq("team.season_id", game.season_id);
    const teamOfUser = new Map(
      (rostered ?? []).map((r) => [
        r.user_id as string,
        (r.team as unknown as { name: string } | null)?.name ?? "",
      ]),
    );
    for (const r of subRows) {
      const userId = r.fill_user_id as string;
      const name = (r.fill as unknown as { full_name: string } | null)?.full_name;
      if (name && !nameOf.has(userId)) nameOf.set(userId, name);
      const from = teamOfUser.get(userId);
      if (from) {
        subFromOf.set(userId, from);
        subFromOf.set(r.id as string, from);
      }
    }
  }

  const eventRows = ((events ?? []) as unknown as GameEventRow[]).map((e) => ({
    ...e,
    // The data layer normally merges these into one opaque key; do the same
    // here so a guest's baskets are attributed rather than dropped.
    user_id: e.user_id ?? e.guest_id,
  }));

  const flow = summarizeFlow(eventRows, game.home_team_id, game.away_team_id);
  const home = teamById.get(game.home_team_id);
  const away = teamById.get(game.away_team_id);

  const input: RecapInput = {
    home: {
      id: game.home_team_id,
      name: home?.name ?? "Home",
      abbrev: home?.abbrev ?? "HOM",
      score: game.home_score,
    },
    away: {
      id: game.away_team_id,
      name: away?.name ?? "Away",
      abbrev: away?.abbrev ?? "AWY",
      score: game.away_score,
    },
    week: game.week,
    isPlayoff: Boolean(game.is_playoff),
    venue: (game.venue as unknown as { name: string } | null)?.name ?? null,
    slot: (game.time_slot as unknown as { label: string } | null)?.label ?? null,
    lines: buildRecapLines(statRows, nameOf, subFromOf),
    ...flow,
  };

  const facts = [
    recapFacts(input),
    "",
    "Every scoring play, in order, with the score after it:",
    playByPlay(eventRows, input, nameOf),
  ].join("\n");

  const written = await write({
    facts,
    task: [
      "Write the recap of this intramural basketball game for the league's app.",
      "Lead with the result. Then tell the game the way it went: who had it early, where the lead moved, and the stretch that decided it — use the score by period, the runs and the go-ahead basket rather than listing numbers.",
      "Name the two or three players whose lines decided it, with their numbers, and at least one player from the losing side.",
      "If someone played as a sub from another team, say so once.",
      "Finish on what decided the game. Do not speculate about standings, the season or anything not in the facts.",
    ].join(" "),
  });

  const plain = fallbackRecap(input);
  const source = written.ok ? "claude" : "fallback";
  const headline = (written.ok && written.headline) || plain.headline;
  const body = written.ok ? written.body : plain.body;

  const { error } = await supabase.from("game_recaps").upsert(
    {
      game_id: gameId,
      headline,
      body,
      model: written.ok ? written.model : "",
      source,
    },
    { onConflict: "game_id" },
  );
  const reason = written.ok ? undefined : written.reason;
  if (error) return { ok: false, source, detail: error.message, reason };

  return { ok: true, source, detail: headline, reason };
}
