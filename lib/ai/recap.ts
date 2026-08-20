import { createClient } from "@/lib/supabase/server";
import { write } from "@/lib/ai/write";
import {
  buildRecapLines,
  fallbackRecap,
  keyPlays,
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
): Promise<{ ok: boolean; source: "claude" | "fallback" | "skipped"; detail: string }> {
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

  const [{ data: teams }, { data: stats }, { data: events }] = await Promise.all([
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
    lines: buildRecapLines(statRows, nameOf),
    ...flow,
  };

  const facts = [
    recapFacts(input),
    "",
    "Closing sequence (most recent last):",
    keyPlays(eventRows, nameOf),
  ].join("\n");

  const written = await write({
    facts,
    task:
      "Write the recap of this intramural basketball game. Lead with the result, then the run of play — how the lead moved and where it turned. Name the two or three players whose lines actually decided it, with their numbers. End on the result's meaning for the two teams if the facts support one, and stop if they don't.",
  });

  const plain = fallbackRecap(input);
  const source = written ? "claude" : "fallback";
  const headline = written?.headline || plain.headline;
  const body = written?.body || plain.body;

  const { error } = await supabase.from("game_recaps").upsert(
    {
      game_id: gameId,
      headline,
      body,
      model: written?.model ?? "",
      source,
    },
    { onConflict: "game_id" },
  );
  if (error) return { ok: false, source, detail: error.message };

  return { ok: true, source, detail: headline };
}
