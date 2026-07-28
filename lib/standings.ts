// Standings with configurable, explainable tiebreakers.
// Pure functions — unit tested in standings.test.ts.

export interface GameResult {
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
  status: string; // counted when 'final' or 'forfeit'
}

export interface TeamStanding {
  teamId: string;
  w: number;
  l: number;
  t: number;
  pct: number;
  pf: number;
  pa: number;
  diff: number;
  streak: string; // "W3" / "L1" / "—"
  last5: string; // "4-1"
  gb: number;
}

export type Tiebreaker = "head_to_head" | "point_diff" | "points_for";

export const DEFAULT_TIEBREAKERS: Tiebreaker[] = [
  "head_to_head",
  "point_diff",
  "points_for",
];

export const TIEBREAKER_LABELS: Record<Tiebreaker, string> = {
  head_to_head: "head-to-head record",
  point_diff: "point differential",
  points_for: "points scored",
};

function countable(g: GameResult) {
  return g.status === "final" || g.status === "forfeit";
}

export interface StandingsResult {
  standings: TeamStanding[];
  /** Human-readable notes for every tie that a tiebreaker resolved. */
  explanations: string[];
}

export function computeStandings(
  teamIds: string[],
  games: GameResult[],
  tiebreakers: Tiebreaker[] = DEFAULT_TIEBREAKERS,
): StandingsResult {
  const rows = new Map<string, TeamStanding>();
  const results = new Map<string, ("W" | "L" | "T")[]>(); // chronological
  for (const id of teamIds) {
    rows.set(id, {
      teamId: id, w: 0, l: 0, t: 0, pct: 0, pf: 0, pa: 0, diff: 0,
      streak: "—", last5: "0-0", gb: 0,
    });
    results.set(id, []);
  }

  const played = games.filter(countable);
  for (const g of played) {
    const home = rows.get(g.home_team_id);
    const away = rows.get(g.away_team_id);
    if (!home || !away) continue;
    home.pf += g.home_score; home.pa += g.away_score;
    away.pf += g.away_score; away.pa += g.home_score;
    if (g.home_score > g.away_score) {
      home.w++; away.l++;
      results.get(g.home_team_id)!.push("W");
      results.get(g.away_team_id)!.push("L");
    } else if (g.away_score > g.home_score) {
      away.w++; home.l++;
      results.get(g.away_team_id)!.push("W");
      results.get(g.home_team_id)!.push("L");
    } else {
      home.t++; away.t++;
      results.get(g.home_team_id)!.push("T");
      results.get(g.away_team_id)!.push("T");
    }
  }

  for (const row of rows.values()) {
    const gp = row.w + row.l + row.t;
    row.pct = gp > 0 ? (row.w + 0.5 * row.t) / gp : 0;
    row.diff = row.pf - row.pa;
    const seq = results.get(row.teamId)!;
    const last5 = seq.slice(-5);
    row.last5 = `${last5.filter((r) => r === "W").length}-${last5.filter((r) => r === "L").length}`;
    if (seq.length > 0) {
      const last = seq[seq.length - 1];
      let n = 0;
      for (let i = seq.length - 1; i >= 0 && seq[i] === last; i--) n++;
      row.streak = `${last}${n}`;
    }
  }

  const explanations: string[] = [];

  // head-to-head record of `a` against the other tied teams
  function h2h(a: string, tied: string[]): number {
    let wins = 0;
    let losses = 0;
    for (const g of played) {
      const opponents =
        g.home_team_id === a ? g.away_team_id :
        g.away_team_id === a ? g.home_team_id : null;
      if (!opponents || !tied.includes(opponents)) continue;
      const aScore = g.home_team_id === a ? g.home_score : g.away_score;
      const oScore = g.home_team_id === a ? g.away_score : g.home_score;
      if (aScore > oScore) wins++;
      else if (oScore > aScore) losses++;
    }
    const total = wins + losses;
    return total > 0 ? wins / total : 0.5;
  }

  const list = [...rows.values()];
  list.sort((a, b) => b.pct - a.pct);

  // resolve groups of equal pct with the configured tiebreakers
  const resolved: TeamStanding[] = [];
  let i = 0;
  while (i < list.length) {
    const group = list.filter((r) => r.pct === list[i].pct);
    if (group.length === 1) {
      resolved.push(group[0]);
      i += group.length;
      continue;
    }
    const tiedIds = group.map((r) => r.teamId);
    const keyed = group.map((r) => {
      const keys: number[] = tiebreakers.map((tb) => {
        if (tb === "head_to_head") return h2h(r.teamId, tiedIds.filter((t) => t !== r.teamId));
        if (tb === "point_diff") return r.diff;
        return r.pf;
      });
      return { r, keys };
    });
    keyed.sort((a, b) => {
      for (let k = 0; k < a.keys.length; k++) {
        if (a.keys[k] !== b.keys[k]) return b.keys[k] - a.keys[k];
      }
      return a.r.teamId.localeCompare(b.r.teamId); // deterministic fallback
    });
    for (let k = 0; k < keyed.length - 1; k++) {
      const a = keyed[k];
      const b = keyed[k + 1];
      const deciding = tiebreakers.find(
        (_, idx) => a.keys[idx] !== b.keys[idx],
      );
      if (deciding) {
        explanations.push(
          `${a.r.teamId} ahead of ${b.r.teamId} on ${TIEBREAKER_LABELS[deciding]}`,
        );
      }
    }
    resolved.push(...keyed.map((k) => k.r));
    i += group.length;
  }

  const leader = resolved[0];
  for (const row of resolved) {
    row.gb = leader
      ? (leader.w - row.w + (row.l - leader.l)) / 2
      : 0;
  }

  return { standings: resolved, explanations };
}
