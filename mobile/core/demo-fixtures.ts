// Generic, sport-agnostic helpers for generating a synthetic season: a
// round-robin schedule and box-score-shaped stat lines whose parts reconcile
// (points = 2×twos + 3×threes + frees, rebounds = off + def). No names, no
// ids, no I/O — pure fixture math, reused by the in-app demo league
// generator (lib/demo-league.ts) and safe to unit test in isolation.

/** Seeded PRNG (mulberry32) so a given seed always produces the same
    fixture — a demo reset regenerates identically, which keeps repeat
    screenshots and QA runs comparable. */
export function makeRng(seed: number) {
  let state = seed | 0;
  return function rnd(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickInt(rnd: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rnd() * (hi - lo + 1));
}

/** Circle method: every team plays every other exactly once per cycle.
    n must be even. */
export function roundRobin(n: number): [number, number][][] {
  if (n < 2 || n % 2 !== 0) throw new Error("roundRobin needs an even team count");
  const ids = [...Array(n).keys()];
  const rounds: [number, number][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < n / 2; i++) pairs.push([ids[i], ids[n - 1 - i]]);
    rounds.push(pairs);
    ids.splice(1, 0, ids.pop()!); // rotate, holding the first fixed
  }
  return rounds;
}

export interface Fixture {
  week: number;
  homeIndex: number;
  awayIndex: number;
  gameOfWeek: number;
}

/** Stretches a single round-robin cycle out to `weeks` weeks by repeating
    early rounds (home/away flipped on the repeat, like a real short season
    rematch) once the cycle is exhausted. */
export function buildFixtures(teamCount: number, weeks: number): Fixture[] {
  const rounds = roundRobin(teamCount);
  const fixtures: Fixture[] = [];
  for (let w = 0; w < weeks; w++) {
    const cycle = Math.floor(w / rounds.length);
    const pairs = rounds[w % rounds.length];
    pairs.forEach(([a, b], g) => {
      const flip = cycle % 2 === 1;
      fixtures.push({
        week: w + 1,
        homeIndex: flip ? b : a,
        awayIndex: flip ? a : b,
        gameOfWeek: g,
      });
    });
  }
  return fixtures;
}

export interface FixtureStatLine {
  pts: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  plus_minus: number;
  minutes: number;
}

/** A box-score line whose parts always reconcile. `scale` shrinks the
    ranges for a partial (in-progress) game — 0.5 reads as "about a half
    played" rather than a full-game line. */
export function statLine(
  rnd: () => number,
  { star = false, scale = 1 }: { star?: boolean; scale?: number } = {},
): FixtureStatLine {
  const s = (lo: number, hi: number) =>
    pickInt(rnd, Math.round(lo * scale), Math.max(Math.round(lo * scale), Math.round(hi * scale)));
  const fg3m = star ? s(2, 4) : s(0, 2);
  const fg2m = star ? s(6, 9) : s(1, 5);
  const ftm = star ? s(3, 6) : s(0, 3);
  const oreb = s(0, 3);
  const dreb = star ? s(4, 7) : s(1, 5);
  return {
    pts: fg2m * 2 + fg3m * 3 + ftm,
    fgm: fg2m + fg3m,
    fga: fg2m + fg3m + s(2, 7),
    tpm: fg3m,
    tpa: fg3m + s(1, 4),
    ftm,
    fta: ftm + s(0, 2),
    oreb,
    dreb,
    reb: oreb + dreb,
    ast: star ? s(4, 7) : s(0, 4),
    stl: s(0, 3),
    blk: s(0, 2),
    tov: s(0, 4),
    pf: s(0, 4),
    plus_minus: 0, // caller sets this once the game margin is known
    minutes: star ? pickInt(rnd, 20, 24) : pickInt(rnd, 9, 20),
  };
}

/** If a game tied, nudge the home side's top scorer by one basket instead
    of fabricating overtime data. Mutates the line in place and returns the
    adjusted home score. */
export function breakTie<T extends { pts: number; fgm: number; fga: number }>(
  homeLines: T[],
  homeScore: number,
): number {
  if (homeLines.length === 0) return homeScore;
  const top = homeLines.reduce((a, b) => (b.pts > a.pts ? b : a));
  top.pts += 2;
  top.fgm += 1;
  top.fga += 1;
  return homeScore + 2;
}

export interface FixtureEvent {
  type: string;
  period: number;
  clockMs: number;
}

/** Expands a stat line's made shots and a few defensive counters into
    discrete, chronologically-orderable events — used to give one showcase
    game (the live demo game) a real, replayable event stream instead of
    only a materialized final line. Not exhaustive (skips misses, fouls,
    turnovers) — just enough for a believable partial play-by-play. */
export function expandLineToEvents(
  rnd: () => number,
  line: Pick<FixtureStatLine, "tpm" | "fgm" | "ftm" | "dreb" | "ast" | "stl">,
  periods: number,
  periodMs: number,
): FixtureEvent[] {
  const events: FixtureEvent[] = [];
  const push = (type: string) =>
    events.push({ type, period: pickInt(rnd, 1, periods), clockMs: pickInt(rnd, 0, periodMs) });
  for (let k = 0; k < line.tpm; k++) push("fg3_made");
  for (let k = 0; k < line.fgm - line.tpm; k++) push("fg2_made");
  for (let k = 0; k < line.ftm; k++) push("ft_made");
  for (let k = 0; k < line.dreb; k++) push("dreb");
  for (let k = 0; k < line.ast; k++) push("ast");
  for (let k = 0; k < line.stl; k++) push("stl");
  return events;
}
