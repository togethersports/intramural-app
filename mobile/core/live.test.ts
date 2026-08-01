import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_RULES, parseGameRules, periodLabel } from "./game-rules";
import {
  deriveOnCourt,
  formatClock,
  teamFoulsInPeriod,
  timeoutsUsed,
  withRunningScore,
  type LiveEvent,
} from "./live";

const HOME = "team-home";
const AWAY = "team-away";

let seq = 0;
function ev(
  type: string,
  user: string | null,
  team: string | null,
  extra: Partial<LiveEvent> = {},
): LiveEvent {
  return {
    seq: ++seq,
    period: 1,
    clock_ms: null,
    type,
    user_id: user,
    team_id: team,
    related_user_id: null,
    voided: false,
    ...extra,
  };
}

describe("parseGameRules", () => {
  it("falls back to defaults for missing or malformed values", () => {
    expect(parseGameRules(null)).toEqual(DEFAULT_GAME_RULES);
    expect(parseGameRules({ foul_limit: "banana", periods: NaN })).toEqual(
      DEFAULT_GAME_RULES,
    );
  });

  it("reads snake_case overrides and clamps them", () => {
    const r = parseGameRules({
      periods: 2,
      period_minutes: 20,
      foul_limit: 6,
      bonus_threshold: 5,
      timeouts_per_team: 99,
      overtime_minutes: 5,
    });
    expect(r.periods).toBe(2);
    expect(r.periodMinutes).toBe(20);
    expect(r.foulLimit).toBe(6);
    expect(r.bonusThreshold).toBe(5);
    expect(r.timeoutsPerTeam).toBe(10); // clamped
    expect(r.overtimeMinutes).toBe(5);
  });

  it("accepts numeric strings", () => {
    expect(parseGameRules({ foul_limit: "4" }).foulLimit).toBe(4);
  });
});

describe("periodLabel", () => {
  it("labels regulation and overtime", () => {
    expect(periodLabel(1, 4)).toBe("Q1");
    expect(periodLabel(4, 4)).toBe("Q4");
    expect(periodLabel(5, 4)).toBe("OT");
    expect(periodLabel(6, 4)).toBe("2OT");
    expect(periodLabel(3, 2)).toBe("OT");
  });
});

describe("teamFoulsInPeriod", () => {
  it("counts personal and technical fouls per team per period", () => {
    seq = 0;
    const events = [
      ev("pf", "h1", HOME),
      ev("pf", "h2", HOME),
      ev("tf", "h1", HOME),
      ev("pf", "a1", AWAY),
      ev("pf", "h3", HOME, { period: 2 }),
    ];
    expect(teamFoulsInPeriod(events, HOME, 1)).toBe(3);
    expect(teamFoulsInPeriod(events, HOME, 2)).toBe(1);
    expect(teamFoulsInPeriod(events, AWAY, 1)).toBe(1);
  });

  it("ignores voided fouls", () => {
    seq = 0;
    const events = [ev("pf", "h1", HOME), ev("pf", "h1", HOME, { voided: true })];
    expect(teamFoulsInPeriod(events, HOME, 1)).toBe(1);
  });
});

describe("timeoutsUsed", () => {
  it("counts non-voided timeouts for the team", () => {
    seq = 0;
    const events = [
      ev("timeout", null, HOME),
      ev("timeout", null, HOME, { voided: true }),
      ev("timeout", null, AWAY),
    ];
    expect(timeoutsUsed(events, HOME)).toBe(1);
    expect(timeoutsUsed(events, AWAY)).toBe(1);
  });
});

describe("deriveOnCourt", () => {
  it("applies subs in sequence order", () => {
    seq = 0;
    const events = [
      ev("sub", "h6", HOME, { related_user_id: "h1" }),
      ev("sub", "h1", HOME, { related_user_id: "h2" }),
    ];
    const sets = deriveOnCourt(events, {
      [HOME]: ["h1", "h2", "h3", "h4", "h5"],
      [AWAY]: ["a1", "a2", "a3", "a4", "a5"],
    });
    expect([...sets[HOME]].sort()).toEqual(["h1", "h3", "h4", "h5", "h6"]);
    expect(sets[AWAY].size).toBe(5);
  });

  it("supports going short-handed (out with nobody in)", () => {
    seq = 0;
    const events = [ev("sub", null, HOME, { related_user_id: "h5" })];
    const sets = deriveOnCourt(events, { [HOME]: ["h1", "h2", "h3", "h4", "h5"] });
    expect(sets[HOME].size).toBe(4);
    expect(sets[HOME].has("h5")).toBe(false);
  });

  it("skips voided subs", () => {
    seq = 0;
    const events = [ev("sub", "h6", HOME, { related_user_id: "h1", voided: true })];
    const sets = deriveOnCourt(events, { [HOME]: ["h1", "h2", "h3", "h4", "h5"] });
    expect(sets[HOME].has("h1")).toBe(true);
    expect(sets[HOME].has("h6")).toBe(false);
  });
});

describe("withRunningScore", () => {
  it("attaches the score after each event, in sequence order", () => {
    seq = 0;
    const events = [
      ev("fg2_made", "h1", HOME),
      ev("dreb", "a1", AWAY),
      ev("fg3_made", "a1", AWAY),
      ev("ft_made", "h2", HOME),
    ];
    const rows = withRunningScore(events, HOME);
    expect(rows.map((r) => [r.home, r.away])).toEqual([
      [2, 0],
      [2, 0],
      [2, 3],
      [3, 3],
    ]);
  });

  it("drops voided events from the log entirely", () => {
    seq = 0;
    const events = [
      ev("fg2_made", "h1", HOME),
      ev("fg2_made", "h1", HOME, { voided: true }),
      ev("fg2_made", "a1", AWAY),
    ];
    const rows = withRunningScore(events, HOME);
    expect(rows).toHaveLength(2);
    expect(rows[1].home).toBe(2);
    expect(rows[1].away).toBe(2);
  });
});

describe("formatClock", () => {
  it("formats minutes:seconds and clamps at zero", () => {
    expect(formatClock(600000)).toBe("10:00");
    expect(formatClock(61500)).toBe("1:01");
    expect(formatClock(900)).toBe("0:00");
    expect(formatClock(null)).toBe("0:00");
    expect(formatClock(-5)).toBe("0:00");
  });
});
