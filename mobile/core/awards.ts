// Weekly and season stat leaders, and who the week belonged to.
//
// Pure. The interesting decision is the last one — a "Player of the Week"
// has to weigh a 30-point night against a 14/12/9 triple-ish line — and it
// is here rather than in a prompt so it is inspectable and testable, and so
// the same answer comes out twice.

import type { PlayerGameStatRow } from "./types";
import { aggregateLines, perGame, type SeasonTotals } from "./stats";

export interface LeaderRow {
  userId: string;
  name: string;
  teamId: string;
  teamName: string;
  value: number;
  totals: SeasonTotals;
  games: number;
}

export interface StatCategory {
  key: string;
  label: string;
  /** Short unit for the card — PPG, RPG… */
  unit: string;
  /** Per-game average of the underlying total. */
  of: (t: SeasonTotals) => number;
}

export const STAT_CATEGORIES: StatCategory[] = [
  { key: "pts", label: "Points", unit: "PPG", of: (t) => t.pts },
  { key: "reb", label: "Rebounds", unit: "RPG", of: (t) => t.reb },
  { key: "ast", label: "Assists", unit: "APG", of: (t) => t.ast },
  { key: "stl", label: "Steals", unit: "SPG", of: (t) => t.stl },
  { key: "blk", label: "Blocks", unit: "BPG", of: (t) => t.blk },
];

export interface StatSource {
  userId: string;
  name: string;
  teamId: string;
  teamName: string;
  lines: PlayerGameStatRow[];
}

/**
 * Leaders in one category, best first.
 *
 * `minGames` keeps a single hot night off the season board — one 30-point
 * game is not a scoring title. For a weekly board it is 1, because a week
 * is usually one game.
 */
export function leadersIn(
  sources: StatSource[],
  category: StatCategory,
  { minGames = 1, limit = 5 }: { minGames?: number; limit?: number } = {},
): LeaderRow[] {
  return sources
    .map((s) => {
      const totals = aggregateLines(s.lines);
      return {
        userId: s.userId,
        name: s.name,
        teamId: s.teamId,
        teamName: s.teamName,
        totals,
        games: totals.games,
        value: perGame(category.of(totals), totals.games),
      };
    })
    .filter((r) => r.games >= minGames && r.value > 0)
    .sort((a, b) => b.value - a.value || b.games - a.games || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/**
 * The week's standout.
 *
 * Weighted so that the things that are hard and helpful outrank the things
 * that are merely numerous: an assist is worth more than a point because it
 * took two people, a steal or a block more still because it ended a
 * possession outright, and a turnover costs. Efficiency gets a small nudge
 * so 20-on-9-shots beats 20-on-24.
 *
 * The weights are a judgement, not a law — but they are one judgement,
 * applied the same way every week, which is the property that matters when
 * a fourteen-year-old asks why it wasn't them.
 */
export function impactScore(t: SeasonTotals): number {
  const shots = t.fga + 0.44 * t.fta;
  const efficiency = shots > 0 ? (t.pts / (2 * shots)) - 0.5 : 0;
  return (
    t.pts * 1 +
    t.reb * 1.2 +
    t.ast * 1.6 +
    t.stl * 2.2 +
    t.blk * 2.2 -
    t.tov * 1.4 +
    efficiency * 6
  );
}

export interface PlayerOfWeek extends LeaderRow {
  impact: number;
}

/** Ranked by impact across the week's games. Null when nobody played. */
export function playerOfTheWeek(sources: StatSource[]): PlayerOfWeek | null {
  const ranked = sources
    .map((s) => {
      const totals = aggregateLines(s.lines);
      return {
        userId: s.userId,
        name: s.name,
        teamId: s.teamId,
        teamName: s.teamName,
        totals,
        games: totals.games,
        value: perGame(totals.pts, totals.games),
        impact: impactScore(totals),
      };
    })
    .filter((r) => r.games > 0)
    .sort((a, b) => b.impact - a.impact || a.name.localeCompare(b.name));
  return ranked[0] ?? null;
}

/** The line as people say it out loud: "21 points, 9 rebounds, 6 assists". */
export function describeLine(t: SeasonTotals): string {
  const parts: string[] = [];
  const add = (n: number, one: string, many: string) => {
    if (n > 0) parts.push(`${n} ${n === 1 ? one : many}`);
  };
  add(t.pts, "point", "points");
  add(t.reb, "rebound", "rebounds");
  add(t.ast, "assist", "assists");
  add(t.stl, "steal", "steals");
  add(t.blk, "block", "blocks");
  if (parts.length === 0) return "no counting stats";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** Facts for the model, in the same shape the recap uses. */
export function awardFacts(
  winner: PlayerOfWeek,
  week: number,
  runnersUp: PlayerOfWeek[],
): string {
  const t = winner.totals;
  const splits = [
    t.fga ? `${t.fgm}/${t.fga} from the field` : null,
    t.tpa ? `${t.tpm}/${t.tpa} from three` : null,
    t.fta ? `${t.ftm}/${t.fta} at the line` : null,
  ].filter(Boolean);

  return [
    `Week ${week} player of the week: ${winner.name} (${winner.teamName}).`,
    `Across ${t.games} ${t.games === 1 ? "game" : "games"}: ${describeLine(t)}.`,
    splits.length ? `Shooting: ${splits.join(", ")}.` : "",
    t.tov ? `Turnovers: ${t.tov}.` : "",
    runnersUp.length
      ? `Also in the conversation: ${runnersUp
          .map((r) => `${r.name} (${r.teamName}), ${describeLine(r.totals)}`)
          .join("; ")}.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** The card written without a model, from the same facts. */
export function fallbackAward(
  winner: PlayerOfWeek,
  week: number,
): { headline: string; body: string } {
  const t = winner.totals;
  return {
    headline: `${winner.name} — Week ${week}`,
    body: `${winner.name} put up ${describeLine(t)} across ${t.games} ${
      t.games === 1 ? "game" : "games"
    } for ${winner.teamName}${
      t.fga ? `, shooting ${t.fgm} of ${t.fga} from the field` : ""
    }.`,
  };
}
