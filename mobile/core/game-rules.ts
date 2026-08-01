// Game-rule settings for the live console, parsed out of `seasons.rules`
// jsonb with basketball defaults. Pure — no I/O (BRIEF §7).

export interface GameRules {
  /** Regular periods in a game (4 quarters by default). */
  periods: number;
  /** Length of one regular period, in minutes. */
  periodMinutes: number;
  /** Personal fouls that disqualify a player. */
  foulLimit: number;
  /** Team fouls in a period that put the opponent in the bonus. */
  bonusThreshold: number;
  /** Timeouts per team for the whole game. */
  timeoutsPerTeam: number;
  /** Length of an overtime period, in minutes. */
  overtimeMinutes: number;
}

export const DEFAULT_GAME_RULES: GameRules = {
  periods: 4,
  periodMinutes: 10,
  foulLimit: 5,
  bonusThreshold: 7,
  timeoutsPerTeam: 4,
  overtimeMinutes: 3,
};

function int(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "string" ? parseInt(v, 10) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Snake_case keys as stored in `seasons.rules`; anything missing or
    malformed falls back to the default. */
export function parseGameRules(
  rules: Record<string, unknown> | null | undefined,
): GameRules {
  const r = rules ?? {};
  return {
    periods: int(r.periods, DEFAULT_GAME_RULES.periods, 1, 8),
    periodMinutes: int(r.period_minutes, DEFAULT_GAME_RULES.periodMinutes, 1, 60),
    foulLimit: int(r.foul_limit, DEFAULT_GAME_RULES.foulLimit, 1, 10),
    bonusThreshold: int(r.bonus_threshold, DEFAULT_GAME_RULES.bonusThreshold, 1, 20),
    timeoutsPerTeam: int(r.timeouts_per_team, DEFAULT_GAME_RULES.timeoutsPerTeam, 0, 10),
    overtimeMinutes: int(r.overtime_minutes, DEFAULT_GAME_RULES.overtimeMinutes, 1, 20),
  };
}

/** "Q2", "Q4", then "OT", "2OT" past regulation. */
export function periodLabel(period: number, totalPeriods: number): string {
  if (period <= totalPeriods) return `Q${period}`;
  const ot = period - totalPeriods;
  return ot === 1 ? "OT" : `${ot}OT`;
}
