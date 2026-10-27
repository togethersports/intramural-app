import { describe, expect, it } from "vitest";
import { buildBracket, hasPlayIn, maxPlayIn, resolveBracket, roundName, seedOrder } from "./bracket";

describe("seedOrder", () => {
  it("produces the classic 8-team pattern", () => {
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
  it("produces the 4-team pattern", () => {
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
  });
});

describe("buildBracket", () => {
  it("builds 4-team bracket: 2 semis + 1 final", () => {
    const plan = buildBracket(4);
    expect(plan.filter((n) => n.round === 1)).toHaveLength(2);
    expect(plan.filter((n) => n.round === 2)).toHaveLength(1);
    const final = plan.find((n) => n.round === 2)!;
    expect(final.homeSource).toBe("winner:1-0");
    expect(final.awaySource).toBe("winner:1-1");
  });

  it("gives byes to top seeds on non-power-of-two fields", () => {
    const plan = buildBracket(6);
    const r1 = plan.filter((n) => n.round === 1);
    expect(r1).toHaveLength(4);
    const byes = r1.filter((n) => n.homeSource === "bye" || n.awaySource === "bye");
    expect(byes).toHaveLength(2);
    // seeds 1 and 2 get the byes
    const byeSeeds = byes
      .flatMap((n) => [n.homeSource, n.awaySource])
      .filter((s) => s.startsWith("seed:"));
    expect(byeSeeds.sort()).toEqual(["seed:1", "seed:2"]);
  });
});

describe("resolveBracket", () => {
  const seeds = ["W", "X", "Y", "Z"]; // seed 1..4

  it("resolves first round from seeds", () => {
    const nodes = resolveBracket(buildBracket(4), seeds, new Map());
    const semi1 = nodes.find((n) => n.round === 1 && n.position === 0)!;
    expect(semi1.homeTeamId).toBe("W"); // seed 1
    expect(semi1.awayTeamId).toBe("Z"); // seed 4
  });

  it("advances winners into later rounds", () => {
    const winners = new Map([
      ["1-0", "W"],
      ["1-1", "Y"],
    ]);
    const nodes = resolveBracket(buildBracket(4), seeds, winners);
    const final = nodes.find((n) => n.round === 2)!;
    expect(final.homeTeamId).toBe("W");
    expect(final.awayTeamId).toBe("Y");
    expect(final.winnerTeamId).toBeNull();
  });

  it("auto-advances byes", () => {
    const seeds6 = ["A", "B", "C", "D", "E", "F"];
    const nodes = resolveBracket(buildBracket(6), seeds6, new Map());
    const seed1Node = nodes.find(
      (n) => n.round === 1 && n.homeSource === "seed:1",
    )!;
    expect(seed1Node.winnerTeamId).toBe("A");
  });
});

describe("roundName", () => {
  it("names the closing rounds", () => {
    expect(roundName(3, 3)).toBe("Championship");
    expect(roundName(2, 3)).toBe("Semifinals");
    expect(roundName(1, 3)).toBe("Quarterfinals");
    expect(roundName(1, 4)).toBe("Round 1");
  });
});

describe("play-in", () => {
  it("plays 4 v 5 for the last spot in a 4-team bracket", () => {
    const plan = buildBracket(5, 1);
    expect(plan.filter((n) => n.round === 1)).toEqual([
      { round: 1, position: 0, homeSource: "seed:4", awaySource: "seed:5" },
    ]);
    const semis = plan.filter((n) => n.round === 2);
    expect(semis).toEqual([
      { round: 2, position: 0, homeSource: "seed:1", awaySource: "winner:1-0" },
      { round: 2, position: 1, homeSource: "seed:2", awaySource: "seed:3" },
    ]);
    expect(plan.filter((n) => n.round === 3)).toHaveLength(1);
  });

  it("plays 3 v 6 and 4 v 5 with six teams, and the winners meet 2 and 1", () => {
    const plan = buildBracket(6, 2);
    expect(plan.filter((n) => n.round === 1).map((n) => [n.homeSource, n.awaySource])).toEqual([
      ["seed:4", "seed:5"],
      ["seed:3", "seed:6"],
    ]);
    expect(plan.filter((n) => n.round === 2).map((n) => [n.homeSource, n.awaySource])).toEqual([
      ["seed:1", "winner:1-0"],
      ["seed:2", "winner:1-1"],
    ]);
  });

  it("resolves the play-in winner into the top seed's game", () => {
    const seeds = ["A", "B", "C", "D", "E"];
    const nodes = resolveBracket(buildBracket(5, 1), seeds, new Map([["1-0", "E"]]));
    const semi = nodes.find((n) => n.round === 2 && n.position === 0)!;
    expect([semi.homeTeamId, semi.awayTeamId]).toEqual(["A", "E"]);
  });

  it("falls back to byes when the play-in doesn't fit", () => {
    // Three play-in games can't feed a 4-team bracket — only two spots exist
    // below the top two.
    expect(buildBracket(7, 3)).toEqual(buildBracket(7));
  });

  it("caps the play-in at half the bracket and at the teams available", () => {
    expect(maxPlayIn(4, 6)).toBe(2);
    expect(maxPlayIn(4, 5)).toBe(1);
    expect(maxPlayIn(4, 4)).toBe(0);
    expect(maxPlayIn(8, 16)).toBe(4);
    expect(maxPlayIn(6, 8)).toBe(0);
  });

  it("names the play-in round, and only when the bracket has one", () => {
    const plan = buildBracket(6, 2);
    expect(hasPlayIn(plan)).toBe(true);
    expect(hasPlayIn(buildBracket(6))).toBe(false);
    expect(hasPlayIn(buildBracket(4))).toBe(false);
    expect(roundName(1, 3, true)).toBe("Play-in");
    expect(roundName(2, 3, true)).toBe("Semifinals");
    expect(roundName(3, 3, true)).toBe("Championship");
  });
});
