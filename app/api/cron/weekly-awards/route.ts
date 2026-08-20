import { NextResponse } from "next/server";
import { generatePlayerOfTheWeek } from "@/lib/ai/award";
import { generateGameRecap } from "@/lib/ai/recap";
import { assertCronAuthorized } from "@/lib/cron";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

/**
 * The weekly sweep.
 *
 * Two jobs, both catch-up rather than real-time:
 *
 *   1. Any finished game that still has no recap gets one. Recaps are
 *      normally written the moment a game finalizes; this is the safety net
 *      for a game that finalized while the model was down, or one that was
 *      back-filled by hand.
 *   2. Every active season's most recently completed week gets a Player of
 *      the Week card, if it doesn't already have one.
 *
 * Both are upserts on a unique key, so running twice is harmless.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Enough to catch up a weekend, few enough to finish inside the timeout. */
const RECAP_BATCH = 12;

export async function GET(request: Request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  if (!isAdminConfigured()) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not set." },
      { status: 503 },
    );
  }

  const supabase = createAdminClient();

  // ---------------------------------------------------------- 1. recaps
  const { data: recapped } = await supabase.from("game_recaps").select("game_id");
  const done = new Set((recapped ?? []).map((r) => r.game_id as string));

  const { data: finished } = await supabase
    .from("games")
    .select("id")
    .in("status", ["final", "forfeit"])
    .order("updated_at", { ascending: false })
    .limit(200);

  const missing = (finished ?? [])
    .map((g) => g.id as string)
    .filter((id) => !done.has(id))
    .slice(0, RECAP_BATCH);

  const recaps: { gameId: string; source: string; detail: string }[] = [];
  for (const gameId of missing) {
    const result = await generateGameRecap(gameId, supabase);
    recaps.push({ gameId, source: result.source, detail: result.detail });
  }

  // ----------------------------------------------------------- 2. awards
  const { data: seasons } = await supabase
    .from("seasons")
    .select("id, num_weeks")
    .in("status", ["active", "playoffs"]);

  const { data: existing } = await supabase
    .from("weekly_awards")
    .select("season_id, week")
    .eq("category", "player_of_the_week");
  const awarded = new Set(
    (existing ?? []).map((a) => `${a.season_id}:${a.week}`),
  );

  const awards: { seasonId: string; week: number; detail: string }[] = [];
  for (const season of seasons ?? []) {
    const seasonId = season.id as string;

    // Weeks that have finished games, newest first. An award is only worth
    // writing once every game in that week is in.
    const { data: weeks } = await supabase
      .from("games")
      .select("week, status")
      .eq("season_id", seasonId);

    const byWeek = new Map<number, { total: number; done: number }>();
    for (const g of weeks ?? []) {
      const bucket = byWeek.get(g.week as number) ?? { total: 0, done: 0 };
      bucket.total += 1;
      if (g.status === "final" || g.status === "forfeit") bucket.done += 1;
      byWeek.set(g.week as number, bucket);
    }

    const complete = [...byWeek.entries()]
      .filter(([, c]) => c.total > 0 && c.done === c.total)
      .map(([week]) => week)
      .sort((a, b) => b - a);

    for (const week of complete) {
      if (awarded.has(`${seasonId}:${week}`)) continue;
      const result = await generatePlayerOfTheWeek(supabase, seasonId, week);
      awards.push({ seasonId, week, detail: result.detail });
      // One new card per season per run: the backlog drains over a few runs
      // rather than blowing the timeout on a season imported all at once.
      break;
    }
  }

  return NextResponse.json({
    ok: true,
    recapsWritten: recaps.length,
    recaps,
    awardsWritten: awards.length,
    awards,
  });
}
