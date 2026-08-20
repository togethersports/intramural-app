import { describe, expect, it } from "vitest";
import {
  fallbackRecap,
  recapFacts,
  standoutLines,
  summarizeFlow,
  type RecapInput,
  type RecapLine,
} from "./recap-input";
import type { GameEventRow } from "./types";

const HOME = "team-home";
const AWAY = "team-away";

let seq = 0;
function ev(
  type: string,
  team: string,
  period = 1,
  overrides: Partial<GameEventRow> = {},
): GameEventRow {
  seq += 1;
  return {
    id: `e${seq}`,
    seq,
    period,
    clock_ms: null,
    user_id: `${team}-p1`,
    team_id: team,
    type,
    value: null,
    related_user_id: null,
    voided: false,
    client_uuid: `c${seq}`,
    guest_id: null,
    ...overrides,
  };
}

describe("summarizeFlow", () => {
  it("buckets scoring by period", () => {
    const flow = summarizeFlow(
      [ev("fg2_made", HOME, 1), ev("fg3_made", AWAY, 1), ev("fg2_made", HOME, 2)],
      HOME,
      AWAY,
    );
    expect(flow.periodScores).toEqual([
      { period: 1, home: 2, away: 3 },
      { period: 2, home: 2, away: 0 },
    ]);
  });

  it("finds the longest unanswered run and stops it when the other side scores", () => {
    const flow = summarizeFlow(
      [
        ev("fg2_made", HOME),
        ev("fg3_made", HOME),
        ev("fg2_made", HOME), // 7 straight
        ev("fg2_made", AWAY),
        ev("fg2_made", HOME),
      ],
      HOME,
      AWAY,
    );
    expect(flow.bestRun).toEqual({ teamId: HOME, points: 7, period: 1 });
  });

  it("ignores a run too short to be worth mentioning", () => {
    const flow = summarizeFlow([ev("fg2_made", HOME), ev("fg2_made", AWAY)], HOME, AWAY);
    expect(flow.bestRun).toBeNull();
  });

  it("counts lead changes, and does not count passing through a tie", () => {
    const flow = summarizeFlow(
      [
        ev("fg2_made", HOME), // 2-0 — taking the first lead is not a change
        ev("fg2_made", AWAY), // 2-2 tied — not a change
        ev("fg3_made", AWAY), // 2-5 away ahead — change 1
        ev("fg3_made", HOME), // 5-5 tied again — still not a change
        ev("fg2_made", HOME), // 7-5 home back ahead — change 2
      ],
      HOME,
      AWAY,
    );
    expect(flow.leadChanges).toBe(2);
  });

  it("does not count a tie as reclaiming the lead", () => {
    // 2-0, then 2-2. Nobody has taken the lead from anybody.
    const flow = summarizeFlow([ev("fg2_made", HOME), ev("fg2_made", AWAY)], HOME, AWAY);
    expect(flow.leadChanges).toBe(0);
  });

  it("records the biggest lead and who held it", () => {
    const flow = summarizeFlow(
      [ev("fg3_made", AWAY), ev("fg3_made", AWAY), ev("fg2_made", HOME)],
      HOME,
      AWAY,
    );
    expect(flow.biggestLead).toEqual({ teamId: AWAY, margin: 6 });
  });

  it("skips voided events entirely", () => {
    const flow = summarizeFlow(
      [ev("fg3_made", HOME, 1, { voided: true }), ev("fg2_made", HOME)],
      HOME,
      AWAY,
    );
    expect(flow.periodScores).toEqual([{ period: 1, home: 2, away: 0 }]);
  });

  it("ignores non-scoring events", () => {
    const flow = summarizeFlow(
      [ev("ast", HOME), ev("dreb", HOME), ev("fg2_made", HOME)],
      HOME,
      AWAY,
    );
    expect(flow.periodScores).toEqual([{ period: 1, home: 2, away: 0 }]);
  });

  it("handles a game with no scoring at all", () => {
    const flow = summarizeFlow([], HOME, AWAY);
    expect(flow).toEqual({
      periodScores: [],
      biggestLead: null,
      bestRun: null,
      leadChanges: 0,
      wasClose: false,
    });
  });
});

const line = (over: Partial<RecapLine>): RecapLine => ({
  userId: "u",
  name: "Player",
  teamId: HOME,
  pts: 0,
  reb: 0,
  ast: 0,
  stl: 0,
  blk: 0,
  tov: 0,
  fgm: 0,
  fga: 0,
  tpm: 0,
  tpa: 0,
  ftm: 0,
  fta: 0,
  plusMinus: 0,
  ...over,
});

describe("standoutLines", () => {
  it("ranks an all-round line above a pure scorer", () => {
    const scorer = line({ name: "Scorer", pts: 18 });
    const allRound = line({ name: "Everything", pts: 12, reb: 9, ast: 7, stl: 3 });
    expect(standoutLines([scorer, allRound])[0].name).toBe("Everything");
  });

  it("leaves out anyone who did nothing countable", () => {
    const names = standoutLines([
      line({ name: "Played", pts: 4 }),
      line({ name: "Sat", tov: 2 }),
    ]).map((l) => l.name);
    expect(names).toEqual(["Played"]);
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      line({ name: `P${i}`, pts: i + 1 }),
    );
    expect(standoutLines(many, 4)).toHaveLength(4);
  });
});

const INPUT: RecapInput = {
  home: { id: HOME, name: "Panthers", abbrev: "PAN", score: 54 },
  away: { id: AWAY, name: "Comets", abbrev: "COM", score: 51 },
  week: 5,
  isPlayoff: false,
  venue: "Main Gym",
  slot: "Period 4 Lunch",
  lines: [
    line({ name: "Harry Stone", pts: 21, reb: 4, ast: 6, fgm: 8, fga: 14 }),
    line({ name: "Devon Cruz", teamId: AWAY, pts: 19, reb: 7, fgm: 7, fga: 15 }),
  ],
  periodScores: [
    { period: 1, home: 14, away: 16 },
    { period: 2, home: 40, away: 35 },
  ],
  biggestLead: { teamId: HOME, margin: 9 },
  bestRun: { teamId: HOME, points: 8, period: 2 },
  leadChanges: 5,
  wasClose: true,
};

describe("recapFacts", () => {
  it("states the final with the winner first", () => {
    expect(recapFacts(INPUT)).toContain("FINAL: Panthers 54, Comets 51.");
  });

  it("carries the shape of the game, not just the box score", () => {
    const facts = recapFacts(INPUT);
    expect(facts).toContain("Longest unanswered run: Panthers, 8 straight");
    expect(facts).toContain("Lead changed hands 5 times.");
    expect(facts).toContain("one-possession game late");
    expect(facts).toContain("Biggest lead: Panthers by 9.");
  });

  it("names each player with their own team", () => {
    const facts = recapFacts(INPUT);
    expect(facts).toContain("Harry Stone (Panthers)");
    expect(facts).toContain("Devon Cruz (Comets)");
  });

  it("omits shooting splits nobody attempted", () => {
    const facts = recapFacts({
      ...INPUT,
      lines: [line({ name: "Nobody Shot", pts: 0, reb: 5 })],
    });
    expect(facts).not.toContain("3PT");
    expect(facts).not.toContain("FT");
  });
});

describe("fallbackRecap", () => {
  it("says who won, by how much, and who did what", () => {
    const { headline, body } = fallbackRecap(INPUT);
    expect(headline).toBe("Panthers edge Comets 54-51");
    expect(body).toContain("Panthers beat Comets 54-51 at Main Gym.");
    expect(body).toContain("Harry Stone had 21");
    expect(body).toContain("The lead changed hands 5 times.");
  });

  it("uses a different verb for a comfortable win", () => {
    const blowout = {
      ...INPUT,
      home: { ...INPUT.home, score: 70 },
      away: { ...INPUT.away, score: 40 },
    };
    expect(fallbackRecap(blowout).headline).toBe("Panthers take it 70-40");
  });

  it("still produces something for a game with no standouts", () => {
    const bare = { ...INPUT, lines: [], bestRun: null, leadChanges: 0 };
    expect(fallbackRecap(bare).body).toContain("Panthers beat Comets");
  });
});
