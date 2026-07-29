import { describe, expect, it } from "vitest";
import {
  aggregateLines,
  computeBoxScore,
  efgPct,
  pct,
  tsPct,
  type GameEventInput,
  type LineupStateInput,
} from "./stats";

const HOME = "team-home";
const AWAY = "team-away";

let seq = 0;
function ev(
  type: string,
  user: string | null,
  team: string | null,
  extra: Partial<GameEventInput> = {},
): GameEventInput {
  return {
    seq: ++seq,
    type,
    user_id: user,
    team_id: team,
    related_user_id: null,
    voided: false,
    ...extra,
  };
}

const starters = (teamId: string, players: string[]): LineupStateInput => ({
  seq: 0,
  team_id: teamId,
  on_court: players,
});

describe("computeBoxScore", () => {
  it("tallies scoring lines and the game score", () => {
    seq = 0;
    const events = [
      ev("fg2_made", "h1", HOME),
      ev("fg3_made", "h1", HOME),
      ev("ft_made", "h2", HOME),
      ev("fg2_miss", "a1", AWAY),
      ev("fg3_miss", "a1", AWAY),
      ev("ft_miss", "a1", AWAY),
      ev("fg2_made", "a2", AWAY),
    ];
    const box = computeBoxScore(events, [], HOME, AWAY);
    expect(box.homeScore).toBe(6);
    expect(box.awayScore).toBe(2);
    const h1 = box.players.get("h1")!;
    expect(h1.pts).toBe(5);
    expect(h1.fgm).toBe(2);
    expect(h1.fga).toBe(2);
    expect(h1.tpm).toBe(1);
    const a1 = box.players.get("a1")!;
    expect(a1.pts).toBe(0);
    expect(a1.fga).toBe(2);
    expect(a1.tpa).toBe(1);
    expect(a1.fta).toBe(1);
  });

  it("counts rebounds, defense, turnovers and fouls", () => {
    seq = 0;
    const events = [
      ev("oreb", "h1", HOME),
      ev("dreb", "h1", HOME),
      ev("ast", "h2", HOME),
      ev("stl", "h2", HOME),
      ev("blk", "a1", AWAY),
      ev("to", "a1", AWAY),
      ev("pf", "a1", AWAY),
      ev("tf", "a1", AWAY),
    ];
    const box = computeBoxScore(events, [], HOME, AWAY);
    const h1 = box.players.get("h1")!;
    expect(h1.oreb).toBe(1);
    expect(h1.dreb).toBe(1);
    expect(h1.reb).toBe(2);
    const a1 = box.players.get("a1")!;
    expect(a1.blk).toBe(1);
    expect(a1.tov).toBe(1);
    expect(a1.pf).toBe(2); // pf + tf
  });

  it("ignores voided events", () => {
    seq = 0;
    const events = [
      ev("fg2_made", "h1", HOME),
      ev("fg2_made", "h1", HOME, { voided: true }),
    ];
    const box = computeBoxScore(events, [], HOME, AWAY);
    expect(box.homeScore).toBe(2);
    expect(box.players.get("h1")!.pts).toBe(2);
  });

  it("computes plus/minus from lineups and substitutions with no manual input", () => {
    seq = 0;
    const lineups = [
      starters(HOME, ["h1", "h2"]),
      starters(AWAY, ["a1", "a2"]),
    ];
    const events = [
      // h1 scores 2: on-court h1,h2 +2; a1,a2 -2
      ev("fg2_made", "h1", HOME),
      // sub: h3 in for h2
      ev("sub", "h3", HOME, { related_user_id: "h2" }),
      // a1 scores 3: a1,a2 +3; h1,h3 -3 (h2 is off the floor)
      ev("fg3_made", "a1", AWAY),
    ];
    const box = computeBoxScore(events, lineups, HOME, AWAY);
    expect(box.players.get("h1")!.plus_minus).toBe(-1); // +2 −3
    expect(box.players.get("h2")!.plus_minus).toBe(2); // only the first bucket
    expect(box.players.get("h3")!.plus_minus).toBe(-3); // only the second
    expect(box.players.get("a1")!.plus_minus).toBe(1); // −2 +3
    expect(box.players.get("a2")!.plus_minus).toBe(1);
  });

  it("lists starters even without events", () => {
    seq = 0;
    const box = computeBoxScore([], [starters(HOME, ["h1"])], HOME, AWAY);
    expect(box.players.get("h1")).toBeDefined();
    expect(box.players.get("h1")!.pts).toBe(0);
  });
});

describe("derived stats", () => {
  it("percentages guard against zero attempts", () => {
    expect(pct(0, 0)).toBeNull();
    expect(pct(5, 10)).toBeCloseTo(0.5);
    expect(efgPct(4, 2, 10)).toBeCloseTo(0.5);
    expect(tsPct(0, 0, 0)).toBeNull();
    // 25 pts on 20 FGA + 5 FTA → 25 / (2 × 22.2)
    expect(tsPct(25, 20, 5)).toBeCloseTo(25 / 44.4);
  });

  it("aggregates season lines", () => {
    seq = 0;
    const box1 = computeBoxScore([ev("fg2_made", "h1", HOME)], [], HOME, AWAY);
    const box2 = computeBoxScore([ev("fg3_made", "h1", HOME)], [], HOME, AWAY);
    const totals = aggregateLines([
      box1.players.get("h1")!,
      box2.players.get("h1")!,
    ]);
    expect(totals.games).toBe(2);
    expect(totals.pts).toBe(5);
    expect(totals.fgm).toBe(2);
  });
});
