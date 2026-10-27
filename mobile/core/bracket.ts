// Single-elimination bracket build + advancement. Pure — unit tested in
// bracket.test.ts.

export interface BracketNodePlan {
  round: number; // 1 = first round
  position: number; // 0-based within round
  homeSource: string; // 'seed:1' | 'winner:r-p' | 'bye'
  awaySource: string;
}

/** Standard seed order for a bracket of `size` (1 vs size, snake pattern). */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const next: number[] = [];
    const n = order.length * 2;
    for (const s of order) {
      next.push(s, n + 1 - s);
    }
    order = next;
  }
  return order;
}

const isPowerOfTwo = (n: number) => n >= 2 && (n & (n - 1)) === 0;

/** Play-in games a bracket of `mainSize` can take with `numTeams` seeded:
    each one adds a team, and at most half the main bracket's spots can be
    played for. */
export function maxPlayIn(mainSize: number, numTeams: number): number {
  if (!isPowerOfTwo(mainSize)) return 0;
  return Math.max(0, Math.min(mainSize / 2, numTeams - mainSize));
}

/** Which seeds meet in each play-in game: the last spots, 4 v 5 first, then
    3 v 6, and so on. */
export function playInMatchups(mainSize: number, playIn: number): [number, number][] {
  return Array.from({ length: playIn }, (_, k) => [mainSize - k, mainSize + 1 + k]);
}

/**
 * Builds the full node plan for `numTeams` seeds.
 *
 * With `playIn` games, the main bracket is `numTeams - playIn` (a power of
 * two) and round 1 is the play-in: the lowest seeds that made it play the
 * ones just below the line for those last spots, and the winner takes the
 * higher seed's place. Without, top seeds get byes when the field isn't a
 * power of two.
 */
export function buildBracket(numTeams: number, playIn = 0): BracketNodePlan[] {
  if (numTeams < 2) return [];
  const mainSize = numTeams - playIn;
  if (playIn > 0 && playIn <= maxPlayIn(mainSize, numTeams)) {
    return withPlayIn(mainSize, playIn);
  }

  let size = 2;
  while (size < numTeams) size *= 2;

  const order = seedOrder(size);
  const nodes: BracketNodePlan[] = [];
  const firstRoundGames = size / 2;

  for (let p = 0; p < firstRoundGames; p++) {
    const homeSeed = order[p * 2];
    const awaySeed = order[p * 2 + 1];
    nodes.push({
      round: 1,
      position: p,
      homeSource: homeSeed <= numTeams ? `seed:${homeSeed}` : "bye",
      awaySource: awaySeed <= numTeams ? `seed:${awaySeed}` : "bye",
    });
  }
  return [...nodes, ...laterRounds(firstRoundGames / 2, 2)];
}

function withPlayIn(mainSize: number, playIn: number): BracketNodePlan[] {
  const nodes: BracketNodePlan[] = playInMatchups(mainSize, playIn).map(([hi, lo], k) => ({
    round: 1,
    position: k,
    homeSource: `seed:${hi}`,
    awaySource: `seed:${lo}`,
  }));

  // A seed whose spot is played for is filled by that play-in's winner.
  const source = (seed: number) =>
    seed > mainSize - playIn ? `winner:1-${mainSize - seed}` : `seed:${seed}`;
  const order = seedOrder(mainSize);
  for (let p = 0; p < mainSize / 2; p++) {
    nodes.push({
      round: 2,
      position: p,
      homeSource: source(order[p * 2]),
      awaySource: source(order[p * 2 + 1]),
    });
  }
  return [...nodes, ...laterRounds(mainSize / 4, 3)];
}

function laterRounds(firstGames: number, firstRound: number): BracketNodePlan[] {
  const nodes: BracketNodePlan[] = [];
  let gamesInRound = firstGames;
  let round = firstRound;
  while (gamesInRound >= 1) {
    for (let p = 0; p < gamesInRound; p++) {
      nodes.push({
        round,
        position: p,
        homeSource: `winner:${round - 1}-${p * 2}`,
        awaySource: `winner:${round - 1}-${p * 2 + 1}`,
      });
    }
    gamesInRound = Math.floor(gamesInRound / 2);
    round++;
  }
  return nodes;
}

/**
 * Whether round 1 of a stored bracket is a play-in. A full first round has
 * twice the games of the round after it; a play-in round has fewer, because
 * the top seeds skip it entirely. (Older brackets padded with byes are full.)
 */
export function hasPlayIn(nodes: { round: number }[]): boolean {
  const r1 = nodes.filter((n) => n.round === 1).length;
  const r2 = nodes.filter((n) => n.round === 2).length;
  return r1 > 0 && r2 > 0 && r1 < 2 * r2;
}

export interface ResolvedNode extends BracketNodePlan {
  homeTeamId: string | null;
  awayTeamId: string | null;
  winnerTeamId: string | null;
}

/**
 * Resolves sources into team ids given the seed list (index 0 = seed 1) and
 * recorded winners. Nodes where one side is a bye auto-advance the other
 * side.
 */
export function resolveBracket(
  plan: BracketNodePlan[],
  seeds: string[],
  winners: Map<string, string>, // key 'round-position' → teamId
): ResolvedNode[] {
  const byKey = new Map<string, ResolvedNode>();

  const resolveSource = (src: string): string | null => {
    if (src === "bye") return null;
    if (src.startsWith("seed:")) {
      const n = parseInt(src.slice(5), 10);
      return seeds[n - 1] ?? null;
    }
    if (src.startsWith("winner:")) {
      const key = src.slice(7);
      const prev = byKey.get(key);
      return prev?.winnerTeamId ?? null;
    }
    return null;
  };

  const sorted = [...plan].sort((a, b) => a.round - b.round || a.position - b.position);
  const out: ResolvedNode[] = [];
  for (const node of sorted) {
    const homeTeamId = resolveSource(node.homeSource);
    const awayTeamId = resolveSource(node.awaySource);
    let winnerTeamId = winners.get(`${node.round}-${node.position}`) ?? null;
    // byes auto-advance
    if (!winnerTeamId) {
      if (homeTeamId && node.awaySource === "bye") winnerTeamId = homeTeamId;
      if (awayTeamId && node.homeSource === "bye") winnerTeamId = awayTeamId;
    }
    const resolved: ResolvedNode = { ...node, homeTeamId, awayTeamId, winnerTeamId };
    byKey.set(`${node.round}-${node.position}`, resolved);
    out.push(resolved);
  }
  return out;
}

export function roundName(round: number, totalRounds: number, playIn = false): string {
  if (playIn && round === 1) return "Play-in";
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return "Championship";
  if (fromEnd === 1) return "Semifinals";
  if (fromEnd === 2) return "Quarterfinals";
  return `Round ${round}`;
}
