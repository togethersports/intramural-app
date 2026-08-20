import { describe, expect, it } from "vitest";
import {
  breakTie,
  buildFixtures,
  expandLineToEvents,
  makeRng,
  pickInt,
  roundRobin,
  statLine,
} from "./demo-fixtures";

describe("makeRng / pickInt", () => {
  it("is deterministic for a given seed", () => {
    const a = makeRng(20260729);
    const b = makeRng(20260729);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("pickInt stays within bounds", () => {
    const rnd = makeRng(1);
    for (let i = 0; i < 200; i++) {
      const v = pickInt(rnd, 3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
  });
});

describe("roundRobin", () => {
  it("rejects an odd team count", () => {
    expect(() => roundRobin(5)).toThrow();
  });

  it("plays every team against every other exactly once per cycle", () => {
    const rounds = roundRobin(8);
    expect(rounds).toHaveLength(7); // n-1 rounds
    const seen = new Set<string>();
    for (const round of rounds) {
      expect(round).toHaveLength(4); // n/2 games per round
      const teamsThisRound = new Set<number>();
      for (const [a, b] of round) {
        expect(teamsThisRound.has(a)).toBe(false);
        expect(teamsThisRound.has(b)).toBe(false);
        teamsThisRound.add(a);
        teamsThisRound.add(b);
        const key = [a, b].sort((x, y) => x - y).join("-");
        expect(seen.has(key)).toBe(false); // no repeat matchup in one cycle
        seen.add(key);
      }
      expect(teamsThisRound.size).toBe(8); // every team plays exactly once
    }
  });
});

describe("buildFixtures", () => {
  it("produces one game per pairing per week and covers every team", () => {
    const fixtures = buildFixtures(8, 9);
    expect(fixtures.filter((f) => f.week === 1)).toHaveLength(4);
    const weeks = new Set(fixtures.map((f) => f.week));
    expect([...weeks].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (let w = 1; w <= 9; w++) {
      const games = fixtures.filter((f) => f.week === w);
      const teams = new Set(games.flatMap((g) => [g.homeIndex, g.awayIndex]));
      expect(teams.size).toBe(8); // every team plays exactly once a week
    }
  });

  it("flips home/away on the repeat cycle", () => {
    const fixtures = buildFixtures(8, 9); // 7-round cycle + 2 repeat weeks
    const week1 = fixtures.filter((f) => f.week === 1);
    const week8 = fixtures.filter((f) => f.week === 8); // repeat of round 1, flipped
    for (const g of week1) {
      const rematch = week8.find(
        (r) => r.homeIndex === g.awayIndex && r.awayIndex === g.homeIndex,
      );
      expect(rematch).toBeTruthy();
    }
  });
});

describe("statLine", () => {
  it("keeps points, field goals, and rebounds internally consistent", () => {
    const rnd = makeRng(7);
    for (let i = 0; i < 100; i++) {
      const l = statLine(rnd, { star: i % 2 === 0 });
      expect(l.pts).toBe(l.fgm * 2 - l.tpm * 2 + l.tpm * 3 + l.ftm);
      expect(l.fga).toBeGreaterThanOrEqual(l.fgm);
      expect(l.tpa).toBeGreaterThanOrEqual(l.tpm);
      expect(l.fta).toBeGreaterThanOrEqual(l.ftm);
      expect(l.reb).toBe(l.oreb + l.dreb);
      expect(l.fgm).toBeGreaterThanOrEqual(l.tpm);
    }
  });

  it("scales ranges down for a partial game", () => {
    const rnd = makeRng(3);
    const full = statLine(rnd, { star: true, scale: 1 });
    const rnd2 = makeRng(3);
    const half = statLine(rnd2, { star: true, scale: 0.4 });
    expect(half.pts).toBeLessThanOrEqual(full.pts);
  });
});

describe("breakTie", () => {
  it("bumps the home team's top scorer by a basket", () => {
    const lines = [{ pts: 10, fgm: 4, fga: 8 }, { pts: 22, fgm: 9, fga: 15 }];
    const newScore = breakTie(lines, 50);
    expect(newScore).toBe(52);
    expect(lines[1].pts).toBe(24);
    expect(lines[1].fgm).toBe(10);
    expect(lines[1].fga).toBe(16);
  });

  it("is a no-op with no lines", () => {
    expect(breakTie([], 40)).toBe(40);
  });
});

describe("expandLineToEvents", () => {
  it("emits exactly the counted events, within period/clock bounds", () => {
    const rnd = makeRng(5);
    const events = expandLineToEvents(
      rnd,
      { tpm: 2, fgm: 5, ftm: 3, dreb: 4, ast: 3, stl: 1 },
      2,
      480_000,
    );
    const counts = events.reduce<Record<string, number>>((acc, e) => {
      acc[e.type] = (acc[e.type] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts.fg3_made).toBe(2);
    expect(counts.fg2_made).toBe(3); // fgm(5) - tpm(2)
    expect(counts.ft_made).toBe(3);
    expect(counts.dreb).toBe(4);
    expect(counts.ast).toBe(3);
    expect(counts.stl).toBe(1);
    for (const e of events) {
      expect(e.period).toBeGreaterThanOrEqual(1);
      expect(e.period).toBeLessThanOrEqual(2);
      expect(e.clockMs).toBeGreaterThanOrEqual(0);
      expect(e.clockMs).toBeLessThanOrEqual(480_000);
    }
  });
});
