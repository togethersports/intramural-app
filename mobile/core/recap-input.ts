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
  /** Their own team's name, when they subbed in for the side on this line. */
  subFrom?: string | null;
}

/** The moment the winner went ahead and stayed there. */
export interface GoAhead {
  period: number;
  /** The score right after it, home and away. */
  home: number;
  away: number;
  /** Who scored it — a player key, as on the event. */
  userId: string | null;
  type: string;
  /** Ahead from their first basket on, never tied or behind after it. */
  wireToWire: boolean;
}

export interface RecapInput {
  home: RecapTeam;
  away: RecapTeam;
  week: number;
  isPlayoff: boolean;
  venue: string | null;
  slot: string | null;
  lines: RecapLine[];
  /** Points scored in each period, in order. */
  periodScores: { period: number; home: number; away: number }[];
  /** The biggest lead either side held, and who held it. */
  biggestLead: { teamId: string; margin: number } | null;
  /** The biggest lead each side held — the loser's is the hole the winner climbed out of. */
  leads: { home: number; away: number };
  /** Longest unanswered scoring run. */
  bestRun: { teamId: string; points: number; period: number } | null;
  /** How many times the lead changed hands. */
  leadChanges: number;
  /** When the winner went ahead for good. Null for a tie, or no scoring. */
  goAhead: GoAhead | null;
  /** True when it was within a possession down the stretch. */
  wasClose: boolean;
}

const POINTS: Record<string, number> = {
  fg2_made: 2,
  fg3_made: 3,
  ft_made: 1,
};

type Flow = Pick<
  RecapInput,
  "periodScores" | "biggestLead" | "leads" | "bestRun" | "leadChanges" | "goAhead" | "wasClose"
>;

/**
 * Replay the events to find the shape of the game: period scores, the
 * biggest lead, the longest run, how often it changed hands, and when the
 * winner went ahead for good.
 *
 * A recap that only has the final line reads like a box score with adjectives.
 * These are the facts that make it read like somebody watched.
 */
export function summarizeFlow(
  events: GameEventRow[],
  homeTeamId: string,
  awayTeamId: string,
): Flow {
  let home = 0;
  let away = 0;
  let lead = 0; // positive = home ahead
  let leadChanges = 0;
  const leads = { home: 0, away: 0 };

  // A "run" is unanswered points: it resets the moment the other side scores.
  let runTeam: string | null = null;
  let runPoints = 0;
  let runPeriod = 1;
  let bestRun: RecapInput["bestRun"] = null;

  const periods = new Map<number, { home: number; away: number }>();
  // Every scoring play's aftermath, for the questions that need hindsight —
  // who ended up winning, and what "late" means in this particular game.
  const after: { period: number; home: number; away: number; userId: string | null; type: string }[] = [];

  for (const e of events) {
    if (e.voided) continue;
    const value = POINTS[e.type];
    if (!value) continue;

    const isHome = e.team_id === homeTeamId;
    const isAway = e.team_id === awayTeamId;
    if (!isHome && !isAway) continue;

    if (isHome) home += value;
    else away += value;

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
    if (margin > leads.home) leads.home = margin;
    if (-margin > leads.away) leads.away = -margin;

    after.push({ period: e.period, home, away, userId: e.user_id, type: e.type });
  }

  // The go-ahead: the last play that took the winner from level-or-behind to
  // in front. If that was the game's first basket, they never gave it up.
  let goAhead: GoAhead | null = null;
  if (home !== away) {
    const sign = Math.sign(home - away);
    let before = 0;
    for (let i = 0; i < after.length; i++) {
      const now = after[i].home - after[i].away;
      if (Math.sign(now) === sign && Math.sign(before) !== sign) {
        goAhead = { ...after[i], wireToWire: i === 0 };
      }
      before = now;
    }
  }

  // "Late" is the last quarter of the game's scoring plays, whatever the
  // game's periods were: some leagues play halves, some one running clock.
  const lateFrom = after.length - Math.max(4, Math.ceil(after.length / 4));
  const finalMargin = Math.abs(home - away);
  const closeLate = after.slice(Math.max(0, lateFrom)).some((a) => Math.abs(a.home - a.away) <= 3);

  const biggestMargin = Math.max(leads.home, leads.away);
  return {
    periodScores: [...periods.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([period, s]) => ({ period, home: s.home, away: s.away })),
    biggestLead:
      biggestMargin > 0
        ? { teamId: leads.home >= leads.away ? homeTeamId : awayTeamId, margin: biggestMargin }
        : null,
    leads,
    bestRun: bestRun && bestRun.points >= 5 ? bestRun : null,
    leadChanges,
    goAhead,
    wasClose: after.length > 0 && (finalMargin <= 3 || (closeLate && finalMargin <= 6)),
  };
}

const standoutScore = (l: RecapLine) =>
  l.pts + l.reb * 1.2 + l.ast * 1.5 + l.stl * 2 + l.blk * 2 - l.tov;

/** Stat lines worth naming, best first. Everyone who scored, plus anyone
 *  whose rebounding or passing carried a possession count of its own. */
export function standoutLines(lines: RecapLine[], limit = 6): RecapLine[] {
  return [...lines]
    .filter((l) => l.pts > 0 || l.reb > 0 || l.ast > 0 || l.stl > 0 || l.blk > 0)
    .sort((a, b) => standoutScore(b) - standoutScore(a) || b.pts - a.pts)
    .slice(0, limit);
}

export function buildRecapLines(
  stats: (PlayerGameStatRow & { user_id: string | null; guest_id?: string | null })[],
  nameOf: Map<string, string>,
  subFromOf: Map<string, string> = new Map(),
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
      subFrom: subFromOf.get(key) ?? null,
    };
  });
}

/* ------------------------------------------------------------- shared bits */

function sides(input: RecapInput) {
  const tied = input.home.score === input.away.score;
  const homeWon = input.home.score > input.away.score;
  const winner = homeWon ? input.home : input.away;
  const loser = homeWon ? input.away : input.home;
  const hi = Math.max(input.home.score, input.away.score);
  const lo = Math.min(input.home.score, input.away.score);
  return { tied, winner, loser, hi, lo, margin: hi - lo };
}

const teamName = (input: RecapInput, id: string) =>
  id === input.home.id ? input.home.name : input.away.name;

/** The score with whoever is ahead first: "28-27". */
const scoreline = (home: number, away: number) =>
  `${Math.max(home, away)}-${Math.min(home, away)}`;

/** Running score after each period, from the per-period points. */
function cumulative(input: RecapInput) {
  let home = 0;
  let away = 0;
  return input.periodScores.map((p) => {
    home += p.home;
    away += p.away;
    return { period: p.period, home, away };
  });
}

/** Short names for the play-by-play, unless two teams share one. */
function shortNames(input: Pick<RecapInput, "home" | "away">) {
  const h = input.home.abbrev?.trim();
  const a = input.away.abbrev?.trim();
  const usable = h && a && h.toUpperCase() !== a.toUpperCase();
  return {
    home: usable ? h : input.home.name,
    away: usable ? a : input.away.name,
  };
}

/* -------------------------------------------------------- facts for a model */

/**
 * The facts, as text for the model.
 *
 * Deliberately terse and tabular: the model is being asked to write, not to
 * infer, and every number it can use is on the page. Anything not here is
 * something it would have to invent. Where the arithmetic matters to the
 * story — who led after each period, the hole a winner climbed out of — it
 * is done here, not left to the model.
 */
export function recapFacts(input: RecapInput): string {
  const { tied, winner, loser, hi, lo, margin } = sides(input);
  const short = shortNames(input);

  const rows = standoutLines(input.lines, 8).map((l) => {
    const bits = [
      `${l.pts} pts`,
      l.reb ? `${l.reb} reb` : null,
      l.ast ? `${l.ast} ast` : null,
      l.stl ? `${l.stl} stl` : null,
      l.blk ? `${l.blk} blk` : null,
      l.tov ? `${l.tov} TO` : null,
      ...madeShots(l),
    ].filter(Boolean);
    const sub = l.subFrom ? `; subbing in from ${l.subFrom}` : "";
    return `- ${l.name} (${teamName(input, l.teamId)}${sub}): ${bits.join(", ")}`;
  });

  const totals = [input.home, input.away].map((t) => {
    const mine = input.lines.filter((l) => l.teamId === t.id);
    const sum = (k: keyof RecapLine) => mine.reduce((n, l) => n + (Number(l[k]) || 0), 0);
    const bits = [
      `${t.score} pts`,
      ...madeShots({ fgm: sum("fgm"), tpm: sum("tpm"), ftm: sum("ftm") }),
      `${sum("reb")} reb`,
      `${sum("ast")} ast`,
      sum("stl") ? `${sum("stl")} stl` : null,
      sum("blk") ? `${sum("blk")} blk` : null,
      sum("tov") ? `${sum("tov")} TO` : null,
    ].filter(Boolean);
    return `- ${t.name}: ${bits.join(", ")}`;
  });

  // One running period (or none recorded) has no "by period" to speak of,
  // and "in period 1" would only invite the model to call it a first half.
  const multiPeriod = input.periodScores.length > 1;
  const inPeriod = (n: number) => (multiPeriod ? ` in period ${n}` : "");
  const afterPeriod = (multiPeriod ? cumulative(input) : [])
    .map((p) => {
      const state =
        p.home === p.away
          ? `tied ${p.home}-${p.away}`
          : `${p.home > p.away ? input.home.name : input.away.name} led ${scoreline(p.home, p.away)}`;
      return `after period ${p.period}, ${state}`;
    })
    .join("; ");

  const trailedBy = tied
    ? 0
    : winner.id === input.home.id
      ? input.leads.away
      : input.leads.home;

  const ga = input.goAhead;
  const goAheadLine = ga
    ? ga.wireToWire
      ? `${winner.name} scored first and never trailed or were tied after that.`
      : `${winner.name} went ahead for good at ${scoreline(ga.home, ga.away)}${inPeriod(ga.period)}${
          ga.userId && nameIn(input, ga.userId)
            ? `, on ${nameIn(input, ga.userId)}'s ${shotWord(ga.type)}`
            : ""
        }.`
    : "";

  // null is "nothing to say"; "" is a deliberate blank line between sections.
  return [
    `${input.isPlayoff ? "Playoff game" : `Week ${input.week}`}${
      input.venue ? ` at ${input.venue}` : ""
    }${input.slot ? ` (${input.slot})` : ""}.`,
    tied
      ? `FINAL: tied, ${input.home.name} ${input.home.score}, ${input.away.name} ${input.away.score}.`
      : `FINAL: ${winner.name} ${hi}, ${loser.name} ${lo}. ${winner.name} won by ${margin}.`,
    `${input.home.name} were the home side. Short names in the play-by-play: ${short.home} = ${input.home.name}, ${short.away} = ${input.away.name}.`,
    afterPeriod ? `Score by period: ${afterPeriod}.` : null,
    input.biggestLead
      ? `Biggest lead: ${teamName(input, input.biggestLead.teamId)} by ${input.biggestLead.margin}.`
      : null,
    trailedBy >= 3 ? `${winner.name} trailed by as many as ${trailedBy} and came back.` : null,
    goAheadLine || null,
    input.bestRun
      ? `Longest unanswered run: ${teamName(input, input.bestRun.teamId)}, ${input.bestRun.points} straight${inPeriod(input.bestRun.period)}.`
      : null,
    input.leadChanges > 0
      ? `Lead changed hands ${input.leadChanges} ${input.leadChanges === 1 ? "time" : "times"}.`
      : null,
    input.wasClose ? "It was a one-possession game late." : null,
    "",
    // Without this the model sees 7 makes, no misses, and writes "a perfect
    // 7-of-7" about a game where nobody counted the misses.
    "Shots are counted as makes only (2PM, 3PM, FTM). Misses aren't tracked, so there are no attempts or shooting percentages — don't describe any.",
    "",
    "Team totals:",
    ...totals,
    "",
    "Player lines, best first:",
    ...rows,
  ]
    .filter((s): s is string => s !== null)
    .join("\n");
}

/** Made shots by kind, zeros left out: "4 2PM, 3 3PM, 5 FTM". */
function madeShots(l: { fgm: number; tpm: number; ftm: number }): string[] {
  const twos = l.fgm - l.tpm;
  return [
    twos ? `${twos} 2PM` : null,
    l.tpm ? `${l.tpm} 3PM` : null,
    l.ftm ? `${l.ftm} FTM` : null,
  ].filter((x): x is string => x !== null);
}

function nameIn(input: RecapInput, key: string): string | null {
  return input.lines.find((l) => l.userId === key)?.name ?? null;
}

function shotWord(type: string): string {
  return type === "fg3_made" ? "3-pointer" : type === "ft_made" ? "free throw" : "basket";
}

/**
 * Every scoring play, with the score after it, for the model to see how the
 * game moved. An assist is folded into the basket it sits next to — the
 * trackers record it just before or just after the make, depending on who
 * was tapping.
 *
 * Long games keep the tail — the end is what a recap is usually about — and
 * say how much was left off, so the model never mistakes the excerpt for the
 * whole game.
 */
export function playByPlay(
  events: GameEventRow[],
  input: Pick<RecapInput, "home" | "away">,
  nameOf: Map<string, string>,
  limit = 60,
): string {
  const short = shortNames(input);
  const live = events.filter((e) => !e.voided);
  const isMadeFg = (e: GameEventRow | undefined) =>
    Boolean(e && (e.type === "fg2_made" || e.type === "fg3_made"));

  // Which basket each assist belongs to: the made field goal right before
  // it, else right after it, by the same team and a different player.
  const assistOn = new Map<number, string>();
  live.forEach((e, i) => {
    if (e.type !== "ast" || !e.user_id) return;
    for (const j of [i - 1, i + 1]) {
      const shot = live[j];
      if (isMadeFg(shot) && shot.team_id === e.team_id && shot.user_id !== e.user_id && !assistOn.has(j)) {
        assistOn.set(j, e.user_id);
        return;
      }
    }
  });

  let home = 0;
  let away = 0;
  const plays: string[] = [];
  live.forEach((e, i) => {
    const value = POINTS[e.type];
    if (!value || (e.team_id !== input.home.id && e.team_id !== input.away.id)) return;
    if (e.team_id === input.home.id) home += value;
    else away += value;
    const who = nameOf.get(e.user_id ?? "") ?? "Unknown player";
    const passer = assistOn.has(i) ? nameOf.get(assistOn.get(i)!) : null;
    plays.push(
      `P${e.period} ${who} ${EVENT_LABELS[e.type] ?? e.type}${passer ? ` (assist: ${passer})` : ""} | ${short.home} ${home}, ${short.away} ${away}`,
    );
  });

  const kept = plays.slice(-limit);
  const dropped = plays.length - kept.length;
  return [dropped > 0 ? `(the first ${dropped} scoring plays are left out)` : "", ...kept]
    .filter(Boolean)
    .join("\n");
}

/* --------------------------------------------------- the recap, no model */

const ONE: Record<string, string> = {
  rebound: "a rebound",
  assist: "an assist",
  steal: "a steal",
  block: "a block",
};

/** "24 points, 13 rebounds and an assist" — zeros left out, plurals right. */
export function describeLine(l: RecapLine, max = 4): string {
  const counted: [number, string][] = [
    [l.reb, "rebound"],
    [l.ast, "assist"],
    [l.stl, "steal"],
    [l.blk, "block"],
  ];
  const parts = [
    l.pts > 0 ? `${l.pts} ${l.pts === 1 ? "point" : "points"}` : null,
    ...counted
      .filter(([n]) => n > 0)
      .sort((a, b) => b[0] - a[0])
      .map(([n, word]) => (n === 1 ? ONE[word] : `${n} ${word}s`)),
  ]
    .filter((p): p is string => Boolean(p))
    .slice(0, max);
  if (parts.length === 0) return "a quiet line";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** An article that sounds right in front of a number: "an 11-0 run". */
const article = (n: number) => (n === 8 || n === 11 || n === 18 || (n >= 80 && n < 90) ? "an" : "a");

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The recap written without a model, from the same facts.
 *
 * Used when no API key is configured, or the model couldn't answer — a league
 * should still get *something* on the game page, and "no recap available" is
 * worse than four honest sentences. Also the reference for what the model is
 * being asked to beat.
 */
export function fallbackRecap(input: RecapInput): { headline: string; body: string } {
  const { tied, winner, loser, hi, lo, margin } = sides(input);
  const final = `${hi}-${lo}`;
  const at = input.venue ? ` at ${input.venue}` : "";

  const ofTeam = (id: string) =>
    standoutLines(input.lines.filter((l) => l.teamId === id), 6);
  const topScorer = (id: string) =>
    [...input.lines.filter((l) => l.teamId === id && l.pts > 0)].sort(
      (a, b) => b.pts - a.pts || standoutScore(b) - standoutScore(a),
    )[0];

  // -------- headline
  let headline: string;
  if (tied) {
    headline = `${input.home.name} and ${input.away.name} finish level at ${final}`;
  } else {
    const verb = margin <= 3 ? "edge" : margin <= 9 ? "beat" : "pull away from";
    headline = `${winner.name} ${verb} ${loser.name} ${final}`;
    const star = topScorer(winner.id);
    if (star && star.pts >= 10 && star.pts * 3 >= winner.score) {
      const named = `${star.name} scores ${star.pts} as ${winner.name} ${verb} ${loser.name}`;
      if (named.length <= 70) headline = named;
    }
  }

  // -------- the result, with the shape of it
  const sentences: string[] = [];
  const trailedBy = tied ? 0 : winner.id === input.home.id ? input.leads.away : input.leads.home;
  if (tied) {
    sentences.push(`${input.home.name} and ${input.away.name} played to a ${final} tie${at}.`);
  } else if (trailedBy >= 5) {
    sentences.push(`${winner.name} came back from ${trailedBy} down to beat ${loser.name} ${final}${at}.`);
  } else if (input.goAhead?.wireToWire && margin >= 4) {
    sentences.push(`${winner.name} led from the first basket to the last in a ${final} win over ${loser.name}${at}.`);
  } else {
    sentences.push(`${winner.name} beat ${loser.name} ${final}${at}.`);
  }

  // How it stood partway, when there were periods to speak of.
  const marks = cumulative(input);
  if (marks.length >= 2) {
    const mid = marks[Math.floor(marks.length / 2) - 1];
    const label = marks.length === 2 ? "at the break" : `after period ${mid.period}`;
    sentences.push(
      mid.home === mid.away
        ? `It was level at ${mid.home}-${mid.away} ${label}.`
        : `${mid.home > mid.away ? input.home.name : input.away.name} led ${scoreline(mid.home, mid.away)} ${label}.`,
    );
  }

  if (input.bestRun) {
    const r = input.bestRun;
    const when = input.periodScores.length > 1 ? ` in period ${r.period}` : "";
    sentences.push(`${teamName(input, r.teamId)} put together ${article(r.points)} ${r.points}-0 run${when}.`);
  }

  const ga = input.goAhead;
  if (input.leadChanges >= 2 && ga && !ga.wireToWire) {
    const scorer = ga.userId ? nameIn(input, ga.userId) : null;
    sentences.push(
      `The lead changed hands ${input.leadChanges} times before ${winner.name} went ahead for good at ${scoreline(ga.home, ga.away)}${
        scorer ? ` on ${scorer}'s ${shotWord(ga.type)}` : ""
      }.`,
    );
  } else if (input.leadChanges >= 2) {
    sentences.push(`The lead changed hands ${input.leadChanges} times.`);
  }

  // -------- the players: the winner's best two, then the loser's best
  const tag = (l: RecapLine) => (l.subFrom ? `${l.name}, in as a sub from ${l.subFrom},` : l.name);
  const firstSide = tied ? input.home : winner;
  const secondSide = tied ? input.away : loser;
  const leader = topScorer(firstSide.id) ?? ofTeam(firstSide.id)[0];
  if (leader) {
    // Makes only — there are no attempts to make a percentage from.
    const threes = leader.tpm >= 3 ? ` made ${leader.tpm} threes and` : "";
    sentences.push(`${tag(leader)}${threes} led ${firstSide.name} with ${describeLine(leader)}.`);
  }
  const helper = ofTeam(firstSide.id).find((l) => l !== leader && (l.pts >= 6 || standoutScore(l) >= 8));
  if (helper) sentences.push(`${tag(helper)} added ${describeLine(helper)}.`);

  const other = topScorer(secondSide.id) ?? ofTeam(secondSide.id)[0];
  if (other) sentences.push(`${capitalize(tag(other))} had ${describeLine(other)} for ${secondSide.name}.`);

  return { headline, body: sentences.join(" ") };
}
