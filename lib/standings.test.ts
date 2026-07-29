import { describe, expect, it } from "vitest";
import { computeStandings, type GameResult } from "./standings";

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
