// Courtside-console derivations: team fouls, timeouts, on-court sets, and
// the play-by-play log with running score. Pure replay over the event
// stream — the same stream computeBoxScore consumes (BRIEF §7).

import { SCORING_POINTS } from "./game-constants";

export interface LiveEvent {
  seq: number;
  period: number;
  clock_ms: number | null;
  team_id: string | null;
  user_id: string | null;
  type: string;
  related_user_id: string | null;
  voided: boolean;
}

function active(events: LiveEvent[]): LiveEvent[] {
  return [...events].filter((e) => !e.voided).sort((a, b) => a.seq - b.seq);
}

/** Personal + technical fouls charged to a team in one period. */
export function teamFoulsInPeriod(
  events: LiveEvent[],
  teamId: string,
  period: number,
): number {
  return events.filter(
    (e) =>
      !e.voided &&
      e.team_id === teamId &&
      e.period === period &&
      (e.type === "pf" || e.type === "tf"),
  ).length;
}

/** Timeouts a team has burned so far. */
export function timeoutsUsed(events: LiveEvent[], teamId: string): number {
  return events.filter(
    (e) => !e.voided && e.team_id === teamId && e.type === "timeout",
  ).length;
}

/**
 * On-court set per team: the starting five evolved by `sub` events
 * (user_id = in, related_user_id = out). A sub with no incoming player
 * legally leaves a team short-handed (foul-out with an empty bench).
 */
export function deriveOnCourt(
  events: LiveEvent[],
  starters: Record<string, ReadonlyArray<string>>,
): Record<string, Set<string>> {
  const sets: Record<string, Set<string>> = {};
  for (const [teamId, five] of Object.entries(starters)) {
    sets[teamId] = new Set(five);
  }
  for (const e of active(events)) {
    if (e.type !== "sub" || !e.team_id || !sets[e.team_id]) continue;
    if (e.related_user_id) sets[e.team_id].delete(e.related_user_id);
    if (e.user_id) sets[e.team_id].add(e.user_id);
  }
  return sets;
}

export interface ScoredEvent<E extends LiveEvent> {
  event: E;
  /** Score immediately after this event. */
  home: number;
  away: number;
}

/**
 * Replays the stream and attaches the running score to every non-voided
 * event, oldest first — reverse it for the console's log panel.
 */
export function withRunningScore<E extends LiveEvent>(
  events: E[],
  homeTeamId: string,
): ScoredEvent<E>[] {
  let home = 0;
  let away = 0;
  const out: ScoredEvent<E>[] = [];
  for (const e of active(events) as E[]) {
    const pts = SCORING_POINTS[e.type] ?? 0;
    if (pts > 0 && e.team_id) {
      if (e.team_id === homeTeamId) home += pts;
      else away += pts;
    }
    out.push({ event: e, home, away });
  }
  return out;
}

/** "7:42" — clock the way it reads on the wall. */
export function formatClock(ms: number | null | undefined): string {
  const v = Math.max(0, ms ?? 0);
  const m = Math.floor(v / 60000);
  const s = Math.floor((v % 60000) / 1000);
  return `${m}:${String(s).padStart(2, "0")}`;
}
