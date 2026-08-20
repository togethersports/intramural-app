// Turning a finished game into the handful of facts a recap is written from.
//
// Pure, so the hard part — deciding what actually mattered in a game — is
// unit-testable without a model. The model's job is prose; this decides what
// the prose is about, and every number it emits is one the box score can be
// checked against.

import type { GameEventRow, PlayerGameStatRow } from "./types";
import { EVENT_LABELS } from "./game-constants";

export interface RecapTeam {
  id: string;
  name: string;
  abbrev: string;
  score: number;
}

export interface RecapLine {
  userId: string;
  name: string;
  teamId: string;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  plusMinus: number;
}

export interface RecapInput {
  home: RecapTeam;
  away: RecapTeam;
  week: number;
  isPlayoff: boolean;
  venue: string | null;
  slot: string | null;
  lines: RecapLine[];
  /** Score after each period, in order. */
  periodScores: { period: number; home: number; away: number }[];
  /** The biggest lead either side held, and who held it. */
  biggestLead: { teamId: string; margin: number } | null;
  /** Longest unanswered scoring run. */
  bestRun: { teamId: string; points: number; period: number } | null;
  /** How many times the lead changed hands. */
  leadChanges: number;
  /** True when the margin was three or fewer in the final period. */
  wasClose: boolean;
}

const POINTS: Record<string, number> = {
  fg2_made: 2,
  fg3_made: 3,
  ft_made: 1,
};

/**
 * Replay the events to find the shape of the game: period scores, the
 * biggest lead, the longest run, and how often it changed hands.
 *
 * A recap that only has the final line reads like a box score with adjectives.
 * These are the facts that make it read like somebody watched.
 */
export function summarizeFlow(
  events: GameEventRow[],
  homeTeamId: string,
  awayTeamId: string,
): Pick<
  RecapInput,
  "periodScores" | "biggestLead" | "bestRun" | "leadChanges" | "wasClose"
> {
  let home = 0;
  let away = 0;
  let lead = 0; // positive = home ahead
  let leadChanges = 0;
  let biggest: { teamId: string; margin: number } | null = null;

  // A "run" is unanswered points: it resets the moment the other side scores.
  let runTeam: string | null = null;
  let runPoints = 0;
  let runPeriod = 1;
  let bestRun: RecapInput["bestRun"] = null;

  const periods = new Map<number, { home: number; away: number }>();
  let lastPeriod = 1;
  let closeLate = false;

  for (const e of events) {
    if (e.voided) continue;
    const value = POINTS[e.type];
    if (!value) continue;

    const isHome = e.team_id === homeTeamId;
    const isAway = e.team_id === awayTeamId;
    if (!isHome && !isAway) continue;

    if (isHome) home += value;
    else away += value;

    lastPeriod = e.period;
    const bucket = periods.get(e.period) ?? { home: 0, away: 0 };
    if (isHome) bucket.home += value;
    else bucket.away += value;
    periods.set(e.period, bucket);

    // runs. Use the resolved id rather than e.team_id — the guard above
    // already proved which side this is, and this keeps it non-null.
    const scoringTeam = isHome ? homeTeamId : awayTeamId;
    if (runTeam === scoringTeam) {
      runPoints += value;
    } else {
      runTeam = scoringTeam;
      runPoints = value;
      runPeriod = e.period;
    }
    if (!bestRun || runPoints > bestRun.points) {
      bestRun = { teamId: runTeam, points: runPoints, period: runPeriod };
    }

    // lead
    const margin = home - away;
    if (margin !== 0 && Math.sign(margin) !== Math.sign(lead) && lead !== 0) {
      leadChanges += 1;
    }
    if (margin !== 0) lead = margin;

    const size = Math.abs(margin);
    if (!biggest || size > biggest.margin) {
      biggest = { teamId: margin > 0 ? homeTeamId : awayTeamId, margin: size };
    }
    if (e.period >= lastPeriod && size <= 3) closeLate = true;
  }

  return {
    periodScores: [...periods.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([period, s]) => ({ period, home: s.home, away: s.away })),
    biggestLead: biggest && biggest.margin > 0 ? biggest : null,
    bestRun: bestRun && bestRun.points >= 5 ? bestRun : null,
    leadChanges,
    wasClose: closeLate && Math.abs(home - away) <= 6,
  };
}

/** Stat lines worth naming, best first. Everyone who scored, plus anyone
 *  whose rebounding or passing carried a possession count of its own. */
export function standoutLines(lines: RecapLine[], limit = 6): RecapLine[] {
  const score = (l: RecapLine) =>
    l.pts + l.reb * 1.2 + l.ast * 1.5 + l.stl * 2 + l.blk * 2 - l.tov;
  return [...lines]
    .filter((l) => l.pts > 0 || l.reb > 0 || l.ast > 0 || l.stl > 0 || l.blk > 0)
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit);
}

export function buildRecapLines(
  stats: (PlayerGameStatRow & { user_id: string | null; guest_id?: string | null })[],
  nameOf: Map<string, string>,
): RecapLine[] {
  return stats.map((s) => {
    const key = (s.user_id ?? s.guest_id) as string;
    return {
      userId: key,
      name: nameOf.get(key) ?? "Unnamed",
      teamId: s.team_id,
      pts: s.pts,
      reb: s.reb,
      ast: s.ast,
      stl: s.stl,
      blk: s.blk,
      tov: s.tov,
      fgm: s.fgm,
      fga: s.fga,
      tpm: s.tpm,
      tpa: s.tpa,
      ftm: s.ftm,
      fta: s.fta,
      plusMinus: s.plus_minus,
    };
  });
}

/**
 * The facts, as text for the model.
 *
 * Deliberately terse and tabular: the model is being asked to write, not to
 * infer, and every number it can use is on the page. Anything not here is
 * something it would have to invent.
 */
export function recapFacts(input: RecapInput): string {
  const teamOf = (id: string) =>
    id === input.home.id ? input.home.name : input.away.name;
  const winner = input.home.score > input.away.score ? input.home : input.away;
  const loser = input.home.score > input.away.score ? input.away : input.home;

  const rows = standoutLines(input.lines).map((l) => {
    const bits = [
      `${l.pts} pts`,
      l.reb ? `${l.reb} reb` : null,
      l.ast ? `${l.ast} ast` : null,
      l.stl ? `${l.stl} stl` : null,
      l.blk ? `${l.blk} blk` : null,
      l.tov ? `${l.tov} TO` : null,
      l.fga ? `${l.fgm}/${l.fga} FG` : null,
      l.tpa ? `${l.tpm}/${l.tpa} 3PT` : null,
      l.fta ? `${l.ftm}/${l.fta} FT` : null,
    ].filter(Boolean);
    return `- ${l.name} (${teamOf(l.teamId)}): ${bits.join(", ")}`;
  });

  const periods = input.periodScores
    .map((p) => `P${p.period} ${p.home}-${p.away}`)
    .join(", ");

  return [
    `${input.isPlayoff ? "Playoff game" : `Week ${input.week}`}${
      input.venue ? ` at ${input.venue}` : ""
    }${input.slot ? ` (${input.slot})` : ""}.`,
    `FINAL: ${winner.name} ${Math.max(input.home.score, input.away.score)}, ${loser.name} ${Math.min(input.home.score, input.away.score)}.`,
    `${input.home.name} were at home.`,
    periods ? `Scoring by period (home-away): ${periods}.` : "",
    input.biggestLead
      ? `Biggest lead: ${teamOf(input.biggestLead.teamId)} by ${input.biggestLead.margin}.`
      : "",
    input.bestRun
      ? `Longest unanswered run: ${teamOf(input.bestRun.teamId)}, ${input.bestRun.points} straight in period ${input.bestRun.period}.`
      : "",
    input.leadChanges > 0 ? `Lead changed hands ${input.leadChanges} times.` : "",
    input.wasClose ? "It was a one-possession game late." : "",
    "",
    "Stat lines:",
    ...rows,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * The recap written without a model, from the same facts.
 *
 * Used when no API key is configured — a league should still get *something*
 * on the game page, and "no recap available" is worse than four honest
 * sentences. Also the reference for what the model is being asked to beat.
 */
export function fallbackRecap(input: RecapInput): { headline: string; body: string } {
  const homeWon = input.home.score > input.away.score;
  const winner = homeWon ? input.home : input.away;
  const loser = homeWon ? input.away : input.home;
  const margin = Math.abs(input.home.score - input.away.score);
  const top = standoutLines(input.lines, 3);
  const teamOf = (id: string) =>
    id === input.home.id ? input.home.name : input.away.name;

  const headline =
    margin <= 3
      ? `${winner.name} edge ${loser.name} ${Math.max(input.home.score, input.away.score)}-${Math.min(input.home.score, input.away.score)}`
      : `${winner.name} take it ${Math.max(input.home.score, input.away.score)}-${Math.min(input.home.score, input.away.score)}`;

  const sentences = [
    `${winner.name} beat ${loser.name} ${Math.max(input.home.score, input.away.score)}-${Math.min(input.home.score, input.away.score)}${
      input.venue ? ` at ${input.venue}` : ""
    }.`,
  ];
  if (input.bestRun) {
    sentences.push(
      `${teamOf(input.bestRun.teamId)} ran off ${input.bestRun.points} straight in period ${input.bestRun.period}.`,
    );
  }
  if (input.leadChanges > 1) {
    sentences.push(`The lead changed hands ${input.leadChanges} times.`);
  }
  for (const l of top) {
    const extras = [
      l.reb ? `${l.reb} rebounds` : null,
      l.ast ? `${l.ast} assists` : null,
    ].filter(Boolean);
    sentences.push(
      `${l.name} had ${l.pts}${extras.length ? ` with ${extras.join(" and ")}` : " points"}${
        extras.length ? "" : ""
      }.`,
    );
  }
  return { headline, body: sentences.join(" ") };
}

/** Play-by-play, trimmed to the lines that carry the story. */
export function keyPlays(
  events: GameEventRow[],
  nameOf: Map<string, string>,
  limit = 40,
): string {
  const scoring = events.filter(
    (e) => !e.voided && (POINTS[e.type] || e.type === "ast" || e.type === "blk"),
  );
  // Keep the tail: the end of a game is what a recap is usually about.
  return scoring
    .slice(-limit)
    .map(
      (e) =>
        `P${e.period} ${nameOf.get(e.user_id ?? "") ?? "—"} ${EVENT_LABELS[e.type] ?? e.type}`,
    )
    .join("\n");
}
