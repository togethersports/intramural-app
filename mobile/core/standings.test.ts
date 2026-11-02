import { describe, expect, it } from "vitest";
import {
  computeStandings,
  deleteBlockedReason,
  isDecided,
  oneOnOnesFrom,
  withOneOnOne,
  type GameResult,
} from "./standings";

const g = (
  home: string,
  away: string,
  hs: number,
  as: number,
  status = "final",
): GameResult => ({
  home_team_id: home,
  away_team_id: away,
  home_score: hs,
  away_score: as,
  status,
});

describe("computeStandings", () => {
  it("computes records, points and games back", () => {
    const games = [
      g("A", "B", 50, 40),
      g("A", "C", 60, 30),
      g("B", "C", 45, 44),
    ];
    const { standings } = computeStandings(["A", "B", "C"], games);
    expect(standings.map((s) => s.teamId)).toEqual(["A", "B", "C"]);
    const a = standings[0];
    expect(a.w).toBe(2);
    expect(a.l).toBe(0);
    expect(a.pf).toBe(110);
    expect(a.pa).toBe(70);
    expect(a.gb).toBe(0);
    expect(standings[1].gb).toBe(1);
    expect(standings[2].gb).toBe(2);
  });

  it("ignores unfinished games, counts forfeits", () => {
    const games = [
      g("A", "B", 50, 40, "scheduled"),
      g("A", "B", 20, 0, "forfeit"),
    ];
    const { standings } = computeStandings(["A", "B"], games);
    expect(standings[0].w).toBe(1);
    expect(standings[1].l).toBe(1);
  });

  it("breaks ties head-to-head first and explains why", () => {
    // A and B both 2-1, but B beat A
    const games = [
      g("B", "A", 50, 45),
      g("A", "C", 60, 30),
      g("A", "D", 60, 30),
      g("B", "C", 55, 30),
      g("D", "B", 40, 30),
      g("C", "D", 25, 20),
    ];
    const { standings, explanations } = computeStandings(
      ["A", "B", "C", "D"],
      games,
    );
    expect(standings[0].teamId).toBe("B");
    expect(standings[1].teamId).toBe("A");
    expect(explanations.some((e) => e.includes("head-to-head"))).toBe(true);
  });

  it("falls through to point differential when head-to-head is even", () => {
    // A and B split their two games; A has better diff
    const games = [
      g("A", "B", 50, 40),
      g("B", "A", 41, 40),
      g("A", "C", 80, 20),
      g("B", "C", 45, 40),
      g("C", "A", 10, 60),
      g("C", "B", 10, 30),
    ];
    const { standings, explanations } = computeStandings(["A", "B", "C"], games);
    expect(standings[0].teamId).toBe("A");
    expect(explanations.some((e) => e.includes("point differential"))).toBe(true);
  });

  it("tracks streak and last5", () => {
    const games = [
      g("A", "B", 10, 20),
      g("A", "B", 30, 20),
      g("A", "B", 30, 20),
    ];
    const { standings } = computeStandings(["A", "B"], games);
    const a = standings.find((s) => s.teamId === "A")!;
    expect(a.streak).toBe("W2");
    expect(a.last5).toBe("2-1");
  });

  it("is deterministic when everything ties", () => {
    const r1 = computeStandings(["B", "A"], []);
    const r2 = computeStandings(["A", "B"], []);
    expect(r1.standings.map((s) => s.teamId)).toEqual(
      r2.standings.map((s) => s.teamId),
    );
  });
});

describe("deleting a game", () => {
  const game = (status: string, counts = true, is_playoff = false) => ({
    status,
    counts_for_standings: counts,
    is_playoff,
  });

  it("allows a live official game — standings have not read it yet", () => {
    // The case that was refused: a pickup game marked official, mid-game.
    expect(isDecided("live")).toBe(false);
    expect(deleteBlockedReason(game("live"))).toBeNull();
  });

  it("allows anything not yet decided", () => {
    for (const status of ["scheduled", "live", "postponed", "abandoned"]) {
      expect(deleteBlockedReason(game(status))).toBeNull();
    }
  });

  it("allows a decided exhibition — it was never in the ledger", () => {
    expect(deleteBlockedReason(game("final", false))).toBeNull();
    expect(deleteBlockedReason(game("forfeit", false))).toBeNull();
  });

  it("protects a decided official result and names the fix", () => {
    for (const status of ["final", "forfeit"]) {
      const reason = deleteBlockedReason(game(status));
      expect(reason).toMatch(/exhibition first/);
    }
  });

  it("protects a playoff game once it starts, but not before", () => {
    expect(deleteBlockedReason(game("scheduled", true, true))).toBeNull();
    expect(deleteBlockedReason(game("live", true, true))).toMatch(/bracket/);
    expect(deleteBlockedReason(game("final", true, true))).toMatch(/bracket/);
  });

  it("agrees with what the standings count", () => {
    // The guard and the ledger share one definition, so a game the standings
    // skip is never one the guard protects as a result.
    const live = g("a", "b", 10, 0, "live");
    expect(computeStandings(["a", "b"], [live]).standings.every((s) => s.w + s.l + s.t === 0)).toBe(true);
    expect(deleteBlockedReason({ ...live, counts_for_standings: true })).toBeNull();
  });
});

describe("tiebreakers: head-to-head, then head-to-head margin, then captains' 1v1", () => {
  it("uses head-to-head point differential, not overall, when the record is split", () => {
    // A and B both 2-1 and split their games, A by +9 in them. B has the far
    // better overall differential (it beat C by 50) — which no longer counts.
    const games = [
      g("A", "B", 50, 40),
      g("B", "A", 41, 40),
      g("B", "C", 80, 30),
      g("A", "C", 45, 40),
    ];
    const { standings, explanations } = computeStandings(["A", "B", "C"], games);
    expect(standings.map((s) => s.teamId)).toEqual(["A", "B", "C"]);
    expect(explanations).toContain("A ahead of B on head-to-head point differential (+9)");
  });

  it("never falls back to points scored", () => {
    const games = [g("A", "B", 50, 40), g("B", "C", 50, 40), g("C", "A", 50, 40), g("A", "C", 50, 40), g("C", "B", 50, 40), g("B", "A", 50, 30)];
    // All 2-2; A and B split, C split with both — a three-way tie on everything
    // but margin among the three.
    const { explanations } = computeStandings(["A", "B", "C"], games);
    expect(explanations.every((e) => !e.includes("points scored"))).toBe(true);
  });

  it("sends a dead-even tie to the captains' 1v1, and flags it until it's recorded", () => {
    // A and B both 1-1, split their own games by the same margin.
    const games = [g("A", "B", 50, 40), g("B", "A", 50, 40)];
    const before = computeStandings(["A", "B"], games);
    expect(before.needsOneOnOne).toEqual([["A", "B"]]);

    const after = computeStandings(["A", "B"], games, { oneOnOnes: [{ winner: "B", loser: "A" }] });
    expect(after.needsOneOnOne).toEqual([]);
    expect(after.standings.map((s) => s.teamId)).toEqual(["B", "A"]);
    expect(after.explanations).toContain("B ahead of A on captains' 1v1");
  });

  it("treats teams that never met as level on head-to-head", () => {
    // A and B never played; both 1-0 against C and D.
    const games = [g("A", "C", 50, 40), g("B", "D", 60, 40)];
    const { needsOneOnOne } = computeStandings(["A", "B", "C", "D"], games);
    expect(needsOneOnOne).toContainEqual(["A", "B"]);
  });

  it("re-runs the steps for the teams left tied after a split", () => {
    // A, B, C all 2-2. A beat both, so head-to-head among the three puts A
    // first and leaves B and C level at 1-2. They start over on their own
    // games: 1-1, B +5 between them — B. (Margins across all three games
    // would have put C ahead: A beat B by 30 but C by only 1.)
    const games = [
      g("A", "B", 50, 20),
      g("A", "C", 41, 40),
      g("B", "C", 50, 40),
      g("C", "B", 45, 40),
      g("X", "A", 50, 40),
      g("X", "A", 50, 40),
      g("B", "Y", 50, 40),
      g("C", "Y", 50, 40),
    ];
    const { standings } = computeStandings(["A", "B", "C", "X", "Y"], games);
    const tied = standings.filter((s) => ["A", "B", "C"].includes(s.teamId)).map((s) => s.teamId);
    expect(tied).toEqual(["A", "B", "C"]);
  });

  it("won't rank a three-way tie by 1v1 until every pair has played one", () => {
    const games: GameResult[] = [g("A", "X", 1, 0), g("B", "X", 1, 0), g("C", "X", 1, 0)];
    const partial = computeStandings(["A", "B", "C", "X"], games, {
      oneOnOnes: [{ winner: "C", loser: "A" }],
    });
    expect(partial.needsOneOnOne).toEqual([["A", "B", "C"]]);

    const full = computeStandings(["A", "B", "C", "X"], games, {
      oneOnOnes: [
        { winner: "C", loser: "A" },
        { winner: "C", loser: "B" },
        { winner: "A", loser: "B" },
      ],
    });
    expect(full.needsOneOnOne).toEqual([]);
    expect(full.standings.map((s) => s.teamId).slice(0, 3)).toEqual(["C", "A", "B"]);
  });

  it("asks for nothing before anyone has played", () => {
    expect(computeStandings(["A", "B", "C"], []).needsOneOnOne).toEqual([]);
  });

  it("replaces an earlier 1v1 between the same teams", () => {
    const once = withOneOnOne([], "A", "B");
    expect(withOneOnOne(once, "B", "A")).toEqual([{ winner: "B", loser: "A" }]);
  });

  it("reads 1v1 results off season rules, ignoring junk", () => {
    expect(
      oneOnOnesFrom({ captains_1v1: [{ winner: "A", loser: "B" }, { winner: "A" }, "x", { winner: "C", loser: "C" }] }),
    ).toEqual([{ winner: "A", loser: "B" }]);
    expect(oneOnOnesFrom(null)).toEqual([]);
  });
});
