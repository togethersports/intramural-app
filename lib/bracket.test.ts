import { describe, expect, it } from "vitest";
import { buildBracket, resolveBracket, roundName, seedOrder } from "./bracket";

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
