import { describe, expect, it } from "vitest";
import {
  STAT_CATEGORIES,
  awardFacts,
  describeLine,
  fallbackAward,
  impactScore,
  leadersIn,
  playerOfTheWeek,
  type StatSource,
} from "./awards";
import { aggregateLines } from "./stats";
import type { PlayerGameStatRow } from "./types";

function line(over: Partial<PlayerGameStatRow> = {}): PlayerGameStatRow {
  return {
    game_id: "g",
    user_id: "u",
    team_id: "t",
    pts: 0,
    fgm: 0,
    fga: 0,
    tpm: 0,
    tpa: 0,
    ftm: 0,
    fta: 0,
    oreb: 0,
    dreb: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tov: 0,
    pf: 0,
    plus_minus: 0,
    ...over,
  };
}

const source = (
  name: string,
  lines: Partial<PlayerGameStatRow>[],
  teamName = "Panthers",
): StatSource => ({
  userId: name,
  name,
  teamId: teamName,
  teamName,
  lines: lines.map((l) => line(l)),
});

const POINTS = STAT_CATEGORIES[0];
const ASSISTS = STAT_CATEGORIES[2];

describe("leadersIn", () => {
  it("ranks by per-game average, not by total", () => {
    const rows = leadersIn(
      [
        source("Volume", [{ pts: 10 }, { pts: 10 }, { pts: 10 }]), // 10.0
        source("Efficient", [{ pts: 22 }]), // 22.0
      ],
      POINTS,
    );
    expect(rows.map((r) => r.name)).toEqual(["Efficient", "Volume"]);
  });

  it("applies a games minimum so one hot night isn't a title", () => {
    const rows = leadersIn(
      [
        source("OneGame", [{ pts: 40 }]),
        source("Regular", [{ pts: 12 }, { pts: 14 }, { pts: 10 }]),
      ],
      POINTS,
      { minGames: 3 },
    );
    expect(rows.map((r) => r.name)).toEqual(["Regular"]);
  });

  it("leaves out anyone with nothing in that category", () => {
    const rows = leadersIn(
      [source("Scorer", [{ pts: 20 }]), source("Passer", [{ ast: 9 }])],
      ASSISTS,
    );
    expect(rows.map((r) => r.name)).toEqual(["Passer"]);
  });

  it("breaks a tie by games played, then by name", () => {
    const rows = leadersIn(
      [
        source("Zed", [{ pts: 10 }]),
        source("Abe", [{ pts: 10 }]),
        source("Most", [{ pts: 10 }, { pts: 10 }]),
      ],
      POINTS,
    );
    expect(rows.map((r) => r.name)).toEqual(["Most", "Abe", "Zed"]);
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      source(`P${i}`, [{ pts: i + 1 }]),
    );
    expect(leadersIn(many, POINTS, { limit: 3 })).toHaveLength(3);
  });
});

describe("impactScore", () => {
  it("values an assist above a point", () => {
    const scorer = aggregateLines([line({ pts: 10, fgm: 5, fga: 10 })]);
    const passer = aggregateLines([line({ pts: 4, ast: 6, fgm: 2, fga: 4 })]);
    expect(impactScore(passer)).toBeGreaterThan(impactScore(scorer));
  });

  it("penalises turnovers", () => {
    const clean = aggregateLines([line({ pts: 12, fgm: 6, fga: 12 })]);
    const loose = aggregateLines([line({ pts: 12, tov: 6, fgm: 6, fga: 12 })]);
    expect(impactScore(clean)).toBeGreaterThan(impactScore(loose));
  });

  it("rewards the same points on fewer shots", () => {
    const efficient = aggregateLines([line({ pts: 20, fgm: 9, fga: 12 })]);
    const chucker = aggregateLines([line({ pts: 20, fgm: 9, fga: 26 })]);
    expect(impactScore(efficient)).toBeGreaterThan(impactScore(chucker));
  });

  it("is zero for a line with nothing in it", () => {
    expect(impactScore(aggregateLines([line()]))).toBe(0);
  });
});

describe("playerOfTheWeek", () => {
  it("picks the all-round line over the bigger scorer", () => {
    const winner = playerOfTheWeek([
      source("Bucket", [{ pts: 28, fgm: 12, fga: 27 }]),
      source("Everything", [{ pts: 16, reb: 12, ast: 8, stl: 4, fgm: 7, fga: 12 }]),
    ]);
    expect(winner?.name).toBe("Everything");
  });

  it("adds up a week of more than one game", () => {
    const winner = playerOfTheWeek([
      source("Twice", [{ pts: 14, reb: 6 }, { pts: 15, reb: 7 }]),
      source("Once", [{ pts: 26, reb: 10 }]),
    ]);
    expect(winner?.name).toBe("Twice");
    expect(winner?.totals.pts).toBe(29);
    expect(winner?.games).toBe(2);
  });

  it("returns null when nobody played", () => {
    expect(playerOfTheWeek([])).toBeNull();
    expect(playerOfTheWeek([source("Absent", [])])).toBeNull();
  });

  it("is deterministic on an exact tie", () => {
    const a = playerOfTheWeek([
      source("Zed", [{ pts: 10, reb: 5 }]),
      source("Abe", [{ pts: 10, reb: 5 }]),
    ]);
    const b = playerOfTheWeek([
      source("Abe", [{ pts: 10, reb: 5 }]),
      source("Zed", [{ pts: 10, reb: 5 }]),
    ]);
    expect(a?.name).toBe("Abe");
    expect(b?.name).toBe("Abe");
  });
});

describe("describeLine", () => {
  it("reads the way people say it", () => {
    expect(describeLine(aggregateLines([line({ pts: 21, reb: 9, ast: 6 })]))).toBe(
      "21 points, 9 rebounds and 6 assists",
    );
  });

  it("singularises", () => {
    expect(describeLine(aggregateLines([line({ pts: 1, ast: 1 })]))).toBe(
      "1 point and 1 assist",
    );
  });

  it("omits the empty categories", () => {
    expect(describeLine(aggregateLines([line({ reb: 4 })]))).toBe("4 rebounds");
  });

  it("says something for an empty line rather than nothing", () => {
    expect(describeLine(aggregateLines([line()]))).toBe("no counting stats");
  });
});

describe("awardFacts and fallbackAward", () => {
  const winner = playerOfTheWeek([
    source("Harry Stone", [{ pts: 21, reb: 9, ast: 6, fgm: 8, fga: 14, tpm: 2, tpa: 5 }]),
  ])!;

  it("states the line and the shooting splits", () => {
    const facts = awardFacts(winner, 5, []);
    expect(facts).toContain("Week 5 player of the week: Harry Stone (Panthers).");
    expect(facts).toContain("21 points, 9 rebounds and 6 assists");
    expect(facts).toContain("8/14 from the field");
    expect(facts).toContain("2/5 from three");
  });

  it("omits a split nobody attempted", () => {
    expect(awardFacts(winner, 5, [])).not.toContain("at the line");
  });

  it("names the runners-up when there are any", () => {
    const other = playerOfTheWeek([source("Amir Katz", [{ pts: 18, reb: 3 }])])!;
    expect(awardFacts(winner, 5, [other])).toContain("Amir Katz (Panthers)");
  });

  it("writes a usable card with no model", () => {
    const { headline, body } = fallbackAward(winner, 5);
    expect(headline).toBe("Harry Stone — Week 5");
    expect(body).toContain("21 points, 9 rebounds and 6 assists");
    expect(body).toContain("for Panthers");
  });
});
