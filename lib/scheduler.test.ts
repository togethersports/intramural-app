import { describe, expect, it } from "vitest";
import {
  generateSchedule,
  roundRobin,
  slotDateFor,
  type SchedulerInput,
} from "./scheduler";

function fullAvailability(
  teams: string[],
  slots: string[],
  count = 6,
): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const t of teams) {
    out[t] = {};
    for (const s of slots) out[t][s] = count;
  }
  return out;
}

const baseInput = (over: Partial<SchedulerInput> = {}): SchedulerInput => ({
  teams: ["T1", "T2", "T3", "T4"],
  weeks: 3,
  slots: [
    { id: "s1", dayOfWeek: 1, label: "Lunch A" },
    { id: "s2", dayOfWeek: 3, label: "Free 6" },
  ],
  venues: [{ id: "v1", splittable: false }],
  availability: fullAvailability(["T1", "T2", "T3", "T4"], ["s1", "s2"]),
  ...over,
});

describe("roundRobin", () => {
  it("every pair meets exactly once", () => {
    const rounds = roundRobin(["A", "B", "C", "D"]);
    const pairs = rounds.flat().map(([a, b]) => [a, b].sort().join("-"));
    expect(pairs.sort()).toEqual(["A-B", "A-C", "A-D", "B-C", "B-D", "C-D"]);
    // no team twice in one round
    for (const round of rounds) {
      const seen = round.flat();
      expect(new Set(seen).size).toBe(seen.length);
    }
  });

  it("handles odd team counts with a bye", () => {
    const rounds = roundRobin(["A", "B", "C"]);
    const pairs = rounds.flat().map(([a, b]) => [a, b].sort().join("-"));
    expect(pairs.sort()).toEqual(["A-B", "A-C", "B-C"]);
  });
});

describe("generateSchedule", () => {
  it("places a full round robin with ample capacity", () => {
    const { games, conflicts } = generateSchedule(baseInput());
    expect(conflicts).toEqual([]);
    expect(games).toHaveLength(6); // C(4,2)
    // max one game per team per week
    const perTeamWeek = new Map<string, number>();
    for (const g of games) {
      for (const t of [g.home, g.away]) {
        const k = `${g.week}:${t}`;
        perTeamWeek.set(k, (perTeamWeek.get(k) ?? 0) + 1);
        expect(perTeamWeek.get(k)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("never double-books a venue cell", () => {
    const { games } = generateSchedule(baseInput());
    const cells = games.map((g) => `${g.week}:${g.slotId}:${g.venueId}`);
    expect(new Set(cells).size).toBe(cells.length);
  });

  it("respects the availability threshold and reports conflicts", () => {
    const availability = fullAvailability(["T1", "T2", "T3", "T4"], ["s1", "s2"]);
    // T4 can never field 4 players
    availability.T4 = { s1: 2, s2: 3 };
    const { games, conflicts } = generateSchedule(baseInput({ availability }));
    expect(games.every((g) => g.home !== "T4" && g.away !== "T4")).toBe(true);
    expect(conflicts).toHaveLength(3); // T4's three matchups
    expect(conflicts[0].reason).toContain("at least 4 players");
  });

  it("uses splittable venues for two concurrent games", () => {
    const input = baseInput({
      weeks: 3,
      slots: [{ id: "s1", dayOfWeek: 1, label: "Lunch A" }],
      venues: [{ id: "v1", splittable: true }],
    });
    const { games, conflicts } = generateSchedule(input);
    expect(conflicts).toEqual([]);
    expect(games).toHaveLength(6);
    const byCell = new Map<string, number>();
    for (const g of games) {
      const k = `${g.week}:${g.slotId}:${g.venueId}`;
      byCell.set(k, (byCell.get(k) ?? 0) + 1);
      expect(byCell.get(k)).toBeLessThanOrEqual(2);
    }
  });

  it("reports capacity conflicts when there is no room", () => {
    const input = baseInput({
      weeks: 1,
      slots: [{ id: "s1", dayOfWeek: 1, label: "Lunch A" }],
      venues: [{ id: "v1", splittable: false }],
    });
    const { games, conflicts } = generateSchedule(input);
    // one cell, four teams → only one game fits (both teams busy caps too)
    expect(games.length).toBeLessThanOrEqual(2);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].reason).toContain("capacity");
  });

  it("prefers slots where more players are available", () => {
    const availability = {
      T1: { s1: 4, s2: 8 },
      T2: { s1: 4, s2: 8 },
    };
    const input = baseInput({
      teams: ["T1", "T2"],
      weeks: 1,
      availability,
    });
    const { games } = generateSchedule(input);
    expect(games).toHaveLength(1);
    expect(games[0].slotId).toBe("s2");
    expect(games[0].score).toBe(8);
  });

  it("is deterministic", () => {
    const a = generateSchedule(baseInput());
    const b = generateSchedule(baseInput());
    expect(a).toEqual(b);
  });
});

describe("slotDateFor", () => {
  it("maps week + day of week onto real dates", () => {
    // 2026-01-05 is a Monday (dow 1)
    expect(slotDateFor("2026-01-05", 1, 1)).toBe("2026-01-05");
    expect(slotDateFor("2026-01-05", 1, 3)).toBe("2026-01-07");
    expect(slotDateFor("2026-01-05", 2, 1)).toBe("2026-01-12");
    // day earlier in the week than the start rolls into the same school week
    expect(slotDateFor("2026-01-05", 1, 0)).toBe("2026-01-11");
  });
});
