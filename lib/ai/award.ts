import { write } from "@/lib/ai/write";
import {
  awardFacts,
  fallbackAward,
  playerOfTheWeek,
  type StatSource,
} from "@core/awards";
import type { PlayerGameStatRow } from "@core/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Write (and store) the Player of the Week card for one season week.
 *
 * Same shape as the recap: `@core/awards` picks the winner and states the
 * facts, the model writes the sentence, and a plain version is stored when
 * there is no model. The pick itself is never the model's — a fourteen-year-
 * old asking "why not me" deserves an answer that is the same every time,
 * so `impactScore` decides and the prose only describes.
 */
export async function generatePlayerOfTheWeek(
  supabase: SupabaseClient,
  seasonId: string,
  week: number,
): Promise<{ ok: boolean; detail: string; winner?: string }> {
  const { data: games } = await supabase
    .from("games")
    .select("id")
    .eq("season_id", seasonId)
    .eq("week", week)
    .in("status", ["final", "forfeit"]);

  const gameIds = (games ?? []).map((g) => g.id as string);
  if (gameIds.length === 0) {
    return { ok: false, detail: `No finished games in week ${week}.` };
  }

  const { data: stats } = await supabase
    .from("player_game_stats")
    .select("*, profile:profiles(full_name)")
    .in("game_id", gameIds)
    // A guest played one game as a favour; they are not in the running for a
    // season award.
    .not("user_id", "is", null);

  const rows = (stats ?? []) as (PlayerGameStatRow & {
    user_id: string;
    profile?: { full_name: string } | null;
  })[];
  if (rows.length === 0) {
    return { ok: false, detail: `No stat lines recorded in week ${week}.` };
  }

  const teamIds = [...new Set(rows.map((r) => r.team_id))];
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name")
    .in("id", teamIds);
  const teamName = new Map(
    (teams ?? []).map((t) => [t.id as string, t.name as string]),
  );

  const byPlayer = new Map<string, StatSource>();
  for (const r of rows) {
    const existing = byPlayer.get(r.user_id);
    if (existing) {
      existing.lines.push(r);
      continue;
    }
    byPlayer.set(r.user_id, {
      userId: r.user_id,
      name: r.profile?.full_name || "Unnamed player",
      teamId: r.team_id,
      teamName: teamName.get(r.team_id) ?? "their team",
      lines: [r],
    });
  }

  const sources = [...byPlayer.values()];
  const winner = playerOfTheWeek(sources);
  if (!winner) return { ok: false, detail: `Nobody played in week ${week}.` };

  const runnersUp = sources
    .map((s) => playerOfTheWeek([s])!)
    .filter((p) => p && p.userId !== winner.userId)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 2);

  const written = await write({
    facts: awardFacts(winner, week, runnersUp),
    task:
      "Write the Player of the Week card. Say who it is, what they did, and — only if the facts show it — what separated them from the others named. Two or three sentences.",
    maxTokens: 600,
  });

  const plain = fallbackAward(winner, week);
  const { error } = await supabase.from("weekly_awards").upsert(
    {
      season_id: seasonId,
      week,
      category: "player_of_the_week",
      user_id: winner.userId,
      team_id: winner.teamId,
      headline: written?.headline || plain.headline,
      blurb: written?.body || plain.body,
      stat_line: {
        games: winner.totals.games,
        pts: winner.totals.pts,
        reb: winner.totals.reb,
        ast: winner.totals.ast,
        stl: winner.totals.stl,
        blk: winner.totals.blk,
        fgm: winner.totals.fgm,
        fga: winner.totals.fga,
        impact: Math.round(winner.impact * 10) / 10,
      },
      source: written ? "claude" : "fallback",
    },
    { onConflict: "season_id,week,category" },
  );
  if (error) return { ok: false, detail: error.message };

  return { ok: true, detail: `Week ${week}: ${winner.name}`, winner: winner.name };
}
