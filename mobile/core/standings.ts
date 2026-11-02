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

/**
 * How a tie on record is broken, in order. The first two come from the
 * games the tied teams played against each other; the last is settled off
 * the books — the captains play 1v1 and the commissioner records who won.
 */
export type Tiebreaker = "head_to_head" | "head_to_head_diff" | "captains_1v1";

export const DEFAULT_TIEBREAKERS: Tiebreaker[] = [
  "head_to_head",
  "head_to_head_diff",
  "captains_1v1",
];

export const TIEBREAKER_LABELS: Record<Tiebreaker, string> = {
  head_to_head: "head-to-head record",
  head_to_head_diff: "head-to-head point differential",
  captains_1v1: "captains' 1v1",
};

/** A captains' 1v1, as recorded by the commissioner. */
export interface OneOnOne {
  winner: string;
  loser: string;
}

/** The 1v1 results stored on a season's rules (`captains_1v1`), dropping
    anything malformed rather than trusting the jsonb. */
export function oneOnOnesFrom(rules: unknown): OneOnOne[] {
  const raw = (rules as { captains_1v1?: unknown } | null | undefined)?.captains_1v1;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is OneOnOne =>
      Boolean(r) &&
      typeof (r as OneOnOne).winner === "string" &&
      typeof (r as OneOnOne).loser === "string" &&
      (r as OneOnOne).winner !== (r as OneOnOne).loser,
  );
}

/** Record a 1v1, replacing any earlier result between the same two teams. */
export function withOneOnOne(results: OneOnOne[], winner: string, loser: string): OneOnOne[] {
  return [
    ...results.filter(
      (r) => !((r.winner === winner && r.loser === loser) || (r.winner === loser && r.loser === winner)),
    ),
    { winner, loser },
  ];
}

/** A game is in the ledger once it is decided. Live and scheduled games are
    not — standings never read them. */
export function isDecided(status: string): boolean {
  return status === "final" || status === "forfeit";
}

function countable(g: GameResult) {
  return isDecided(g.status);
}

/**
 * Why a game cannot be deleted, or null when it can.
 *
 * The rule lives beside `isDecided` because it is the same idea: what the
 * standings read is the ledger, and the ledger is not deleted out from under
 * them. Everything else can go — including a live game, which nothing has
 * counted yet. Each reason names the fix rather than just the refusal.
 */
export function deleteBlockedReason(g: {
  status: string;
  counts_for_standings: boolean;
  is_playoff?: boolean;
}): string | null {
  // The bracket node points at its game; deleting one that has started would
  // leave a round with a hole in it.
  if (g.is_playoff && g.status !== "scheduled") {
    return "Playoff games can't be deleted once they start — the bracket is built on them.";
  }
  if (isDecided(g.status) && g.counts_for_standings) {
    return "This result is in the standings. Make it an exhibition first, then delete it.";
  }
  return null;
}

export interface StandingsResult {
  standings: TeamStanding[];
  /** Human-readable notes for every tie that a tiebreaker resolved. */
  explanations: string[];
  /**
   * Teams still level after everything the games can settle — same record,
   * same head-to-head record, same head-to-head point differential — and no
   * 1v1 recorded between them. Each group needs a captains' 1v1. Until then
   * they're listed in a fixed but arbitrary order.
   */
  needsOneOnOne: string[][];
}

/** Code-unit compare, not localeCompare — see scheduler.ts. This is the
    order of last resort and must match across runtimes. */
const byId = (a: { teamId: string }, b: { teamId: string }) =>
  a.teamId < b.teamId ? -1 : a.teamId > b.teamId ? 1 : 0;

export function computeStandings(
  teamIds: string[],
  games: GameResult[],
  { oneOnOnes = [] }: { oneOnOnes?: OneOnOne[] } = {},
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
  const needsOneOnOne: string[][] = [];

  /** `a`'s games against the rest of `group`: record and point margin. */
  function headToHead(a: string, group: string[]) {
    let w = 0, l = 0, t = 0, margin = 0;
    for (const g of played) {
      const opp = g.home_team_id === a ? g.away_team_id : g.away_team_id === a ? g.home_team_id : null;
      if (!opp || opp === a || !group.includes(opp)) continue;
      const mine = g.home_team_id === a ? g.home_score : g.away_score;
      const theirs = g.home_team_id === a ? g.away_score : g.home_score;
      margin += mine - theirs;
      if (mine > theirs) w++;
      else if (theirs > mine) l++;
      else t++;
    }
    const gp = w + l + t;
    // Teams that never met are even on this, not behind.
    return { w, l, t, pct: gp > 0 ? (w + 0.5 * t) / gp : 0.5, margin };
  }

  /** Split `group` into runs of equal `key`, best first. */
  function split(group: TeamStanding[], key: (r: TeamStanding) => number): TeamStanding[][] {
    const sorted = [...group].sort((a, b) => key(b) - key(a) || byId(a, b));
    const out: TeamStanding[][] = [];
    for (const r of sorted) {
      const last = out[out.length - 1];
      if (last && key(last[0]) === key(r)) last.push(r);
      else out.push([r]);
    }
    return out;
  }

  const ids = (rs: TeamStanding[]) => rs.map((r) => r.teamId).join(" and ");

  function explain(buckets: TeamStanding[][], group: TeamStanding[], tb: Tiebreaker) {
    const among = group.length > 2 ? ` among ${ids(group)}` : "";
    for (let k = 0; k < buckets.length - 1; k++) {
      const upper = buckets[k];
      const lower = buckets[k + 1];
      let detail = "";
      if (group.length === 2) {
        const h = headToHead(upper[0].teamId, [lower[0].teamId]);
        detail =
          tb === "head_to_head"
            ? ` (${h.w}-${h.l}${h.t ? `-${h.t}` : ""})`
            : tb === "head_to_head_diff"
              ? ` (+${h.margin})`
              : "";
      }
      explanations.push(`${ids(upper)} ahead of ${ids(lower)} on ${TIEBREAKER_LABELS[tb]}${among}${detail}`);
    }
  }

  /**
   * Order a group level on record. Each step looks only at the games among
   * the teams still tied, and a group that splits starts over with its
   * smaller pieces — so three teams tied, one of which beat both others,
   * leaves the other two decided by their own game, not by all three.
   */
  function breakTie(group: TeamStanding[]): TeamStanding[] {
    if (group.length < 2) return group;
    const members = group.map((r) => r.teamId);

    const h2h = new Map(members.map((id) => [id, headToHead(id, members)]));
    const byRecord = split(group, (r) => h2h.get(r.teamId)!.pct);
    if (byRecord.length > 1) {
      explain(byRecord, group, "head_to_head");
      return byRecord.flatMap(breakTie);
    }
    const byMargin = split(group, (r) => h2h.get(r.teamId)!.margin);
    if (byMargin.length > 1) {
      explain(byMargin, group, "head_to_head_diff");
      return byMargin.flatMap(breakTie);
    }
    return byOneOnOne(group);
  }

  /** The captains' 1v1 — only once every pair in the group has played one,
      so nobody is ranked above a team they never faced. */
  function byOneOnOne(group: TeamStanding[]): TeamStanding[] {
    const members = group.map((r) => r.teamId);
    const fixed = [...group].sort(byId);
    // Level because nobody has played yet isn't a tie anyone needs to break.
    if (group.every((r) => r.w + r.l + r.t === 0)) return fixed;
    const result = (a: string, b: string) =>
      oneOnOnes.find((r) => (r.winner === a && r.loser === b) || (r.winner === b && r.loser === a));
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        if (!result(members[i], members[j])) {
          needsOneOnOne.push(fixed.map((r) => r.teamId));
          return fixed;
        }
      }
    }
    const wins = (id: string) =>
      members.filter((other) => other !== id && result(id, other)?.winner === id).length;
    const buckets = split(group, (r) => wins(r.teamId));
    explain(buckets, group, "captains_1v1");
    return buckets.flatMap((b) => {
      // A 1v1 cycle (A beat B, B beat C, C beat A) settles nothing.
      if (b.length > 1) needsOneOnOne.push([...b].sort(byId).map((r) => r.teamId));
      return [...b].sort(byId);
    });
  }

  const resolved = split([...rows.values()], (r) => r.pct).flatMap(breakTie);

  const leader = resolved[0];
  for (const row of resolved) {
    row.gb = leader
      ? (leader.w - row.w + (row.l - leader.l)) / 2
      : 0;
  }

  return { standings: resolved, explanations, needsOneOnOne };
}
