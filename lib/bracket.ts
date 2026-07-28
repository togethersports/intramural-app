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

/**
 * Builds the full node plan for `numTeams` seeds. Top seeds get byes when
 * the field isn't a power of two.
 */
export function buildBracket(numTeams: number): BracketNodePlan[] {
  if (numTeams < 2) return [];
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

  let gamesInRound = firstRoundGames / 2;
  let round = 2;
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

export function roundName(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return "Championship";
  if (fromEnd === 1) return "Semifinals";
  if (fromEnd === 2) return "Quarterfinals";
  return `Round ${round}`;
}
