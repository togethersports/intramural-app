// Box score + plus/minus engine. Pure functions, no I/O — unit tested in
// stats.test.ts (BRIEF §7: stat logic separate from UI).

import { SCORING_POINTS } from "./game-constants";

export interface GameEventInput {
  seq: number;
  type: string;
  team_id: string | null;
  user_id: string | null;
  related_user_id: string | null;
  voided: boolean;
}

export interface LineupStateInput {
  seq: number;
  team_id: string;
  on_court: string[];
}

export interface StatLine {
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
}

export interface BoxScore {
  players: Map<string, StatLine & { team_id: string }>;
  homeScore: number;
  awayScore: number;
}

export function emptyLine(): StatLine {
  return {
    pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0,
    oreb: 0, dreb: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0,
    plus_minus: 0,
  };
}

/**
 * Replays the event stream into per-player stat lines and the score.
 * Plus/minus comes automatically from on-court sets: the initial lineup per
 * team (lowest-seq lineup state) evolved by `sub` events
 * (user_id = in, related_user_id = out).
 */
export function computeBoxScore(
  events: GameEventInput[],
  lineups: LineupStateInput[],
  homeTeamId: string,
  awayTeamId: string,
): BoxScore {
  const players = new Map<string, StatLine & { team_id: string }>();
  const line = (userId: string, teamId: string) => {
    let l = players.get(userId);
    if (!l) {
      l = { ...emptyLine(), team_id: teamId };
      players.set(userId, l);
    }
    return l;
  };

  // starting five per team = the lowest-seq lineup state
  const onCourt = new Map<string, Set<string>>();
  for (const teamId of [homeTeamId, awayTeamId]) {
    const states = lineups
      .filter((s) => s.team_id === teamId)
      .sort((a, b) => a.seq - b.seq);
    onCourt.set(teamId, new Set(states[0]?.on_court ?? []));
    // starters should appear in the box score even with zero events
    for (const u of states[0]?.on_court ?? []) line(u, teamId);
  }

  let homeScore = 0;
  let awayScore = 0;
  const sorted = [...events]
    .filter((e) => !e.voided)
    .sort((a, b) => a.seq - b.seq);

  for (const e of sorted) {
    if (e.type === "sub" && e.team_id) {
      const set = onCourt.get(e.team_id);
      if (set) {
        if (e.related_user_id) set.delete(e.related_user_id);
        if (e.user_id) {
          set.add(e.user_id);
          line(e.user_id, e.team_id);
        }
      }
      continue;
    }
    if (!e.user_id || !e.team_id) continue;
    const l = line(e.user_id, e.team_id);

    switch (e.type) {
      case "fg2_made":
        l.pts += 2; l.fgm++; l.fga++;
        break;
      case "fg2_miss":
        l.fga++;
        break;
      case "fg3_made":
        l.pts += 3; l.fgm++; l.fga++; l.tpm++; l.tpa++;
        break;
      case "fg3_miss":
        l.fga++; l.tpa++;
        break;
      case "ft_made":
        l.pts += 1; l.ftm++; l.fta++;
        break;
      case "ft_miss":
        l.fta++;
        break;
      case "oreb":
        l.oreb++; l.reb++;
        break;
      case "dreb":
        l.dreb++; l.reb++;
        break;
      case "ast":
        l.ast++;
        break;
      case "stl":
        l.stl++;
        break;
      case "blk":
        l.blk++;
        break;
      case "to":
        l.tov++;
        break;
      case "pf":
      case "tf":
        l.pf++;
        break;
      default:
        break;
    }

    const pts = SCORING_POINTS[e.type] ?? 0;
    if (pts > 0) {
      const scoringHome = e.team_id === homeTeamId;
      if (scoringHome) homeScore += pts;
      else awayScore += pts;
      const otherTeam = scoringHome ? awayTeamId : homeTeamId;
      for (const u of onCourt.get(e.team_id) ?? []) {
        line(u, e.team_id).plus_minus += pts;
      }
      for (const u of onCourt.get(otherTeam) ?? []) {
        line(u, otherTeam).plus_minus -= pts;
      }
    }
  }

  return { players, homeScore, awayScore };
}

/* ------------------------------- derived stats ------------------------------ */

export function pct(made: number, attempts: number): number | null {
  return attempts > 0 ? made / attempts : null;
}

/** Effective FG%: (FGM + 0.5 × 3PM) / FGA */
export function efgPct(fgm: number, tpm: number, fga: number): number | null {
  return fga > 0 ? (fgm + 0.5 * tpm) / fga : null;
}

/** True shooting: PTS / (2 × (FGA + 0.44 × FTA)) */
export function tsPct(pts: number, fga: number, fta: number): number | null {
  const denom = 2 * (fga + 0.44 * fta);
  return denom > 0 ? pts / denom : null;
}

export function formatPct(v: number | null): string {
  return v === null ? "—" : `${(v * 100).toFixed(1)}%`;
}

export interface SeasonTotals extends StatLine {
  games: number;
}

export function aggregateLines(lines: StatLine[]): SeasonTotals {
  const t: SeasonTotals = { ...emptyLine(), games: lines.length };
  for (const l of lines) {
    t.pts += l.pts; t.fgm += l.fgm; t.fga += l.fga; t.tpm += l.tpm;
    t.tpa += l.tpa; t.ftm += l.ftm; t.fta += l.fta; t.oreb += l.oreb;
    t.dreb += l.dreb; t.reb += l.reb; t.ast += l.ast; t.stl += l.stl;
    t.blk += l.blk; t.tov += l.tov; t.pf += l.pf;
    t.plus_minus += l.plus_minus;
  }
  return t;
}

export function perGame(total: number, games: number): number {
  return games > 0 ? total / games : 0;
}
