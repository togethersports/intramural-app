import { describe, expect, it } from "vitest";
import {
  describeLine,
  fallbackRecap,
  playByPlay,
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
      leads: { home: 0, away: 0 },
      bestRun: null,
      leadChanges: 0,
      goAhead: null,
      wasClose: false,
    });
  });

  it("finds the basket that put the winner ahead for good", () => {
    const flow = summarizeFlow(
      [
        ev("fg2_made", HOME), // 2-0
        ev("fg3_made", AWAY), // 2-3
        ev("fg2_made", HOME, 2, { user_id: "closer" }), // 4-3 — for good
      ],
      HOME,
      AWAY,
    );
    expect(flow.goAhead).toMatchObject({ period: 2, home: 4, away: 3, userId: "closer", wireToWire: false });
  });

  it("ignores a lead the winner later gave back", () => {
    const flow = summarizeFlow(
      [
        ev("fg2_made", HOME, 1, { user_id: "early" }), // 2-0
        ev("fg2_made", AWAY), // 2-2
        ev("fg3_made", HOME, 1, { user_id: "late" }), // 5-2
      ],
      HOME,
      AWAY,
    );
    expect(flow.goAhead?.userId).toBe("late");
  });

  it("calls it wire to wire when the winner scored first and never looked back", () => {
    const flow = summarizeFlow(
      [ev("fg2_made", HOME), ev("fg2_made", HOME), ev("fg2_made", AWAY)],
      HOME,
      AWAY,
    );
    expect(flow.goAhead?.wireToWire).toBe(true);
  });

  it("records the biggest lead each side held", () => {
    const flow = summarizeFlow(
      [ev("fg3_made", AWAY), ev("fg3_made", AWAY), ev("fg3_made", HOME), ev("fg3_made", HOME), ev("fg3_made", HOME)],
      HOME,
      AWAY,
    );
    expect(flow.leads).toEqual({ home: 3, away: 6 });
  });

  it("has no go-ahead in a tie", () => {
    const flow = summarizeFlow([ev("fg2_made", HOME), ev("fg2_made", AWAY)], HOME, AWAY);
    expect(flow.goAhead).toBeNull();
  });

  it("does not call a blowout close because the first basket was", () => {
    // 2-0 after the opening basket is "within three", but nobody would call
    // a 30-point win a one-possession game late.
    const events = [ev("fg2_made", HOME), ...Array.from({ length: 15 }, () => ev("fg2_made", HOME))];
    expect(summarizeFlow(events, HOME, AWAY).wasClose).toBe(false);
  });

  it("calls a game close when it was within a possession down the stretch", () => {
    const events = [
      ...Array.from({ length: 6 }, (_, i) => ev("fg2_made", i % 2 ? AWAY : HOME)),
      ev("fg2_made", HOME),
      ev("fg2_made", HOME),
    ];
    expect(summarizeFlow(events, HOME, AWAY).wasClose).toBe(true);
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
    line({ userId: "u", name: "Harry Stone", pts: 21, reb: 4, ast: 6, fgm: 8, fga: 14 }),
    line({ userId: "v", name: "Devon Cruz", teamId: AWAY, pts: 19, reb: 7, fgm: 7, fga: 15 }),
  ],
  periodScores: [
    { period: 1, home: 14, away: 16 },
    { period: 2, home: 40, away: 35 },
  ],
  biggestLead: { teamId: HOME, margin: 9 },
  leads: { home: 9, away: 4 },
  bestRun: { teamId: HOME, points: 8, period: 2 },
  leadChanges: 5,
  goAhead: { period: 2, home: 46, away: 45, userId: "u", type: "fg3_made", wireToWire: false },
  wasClose: true,
};

describe("recapFacts", () => {
  it("states the final with the winner first", () => {
    expect(recapFacts(INPUT)).toContain("FINAL: Panthers 54, Comets 51. Panthers won by 3.");
  });

  it("carries the shape of the game, not just the box score", () => {
    const facts = recapFacts(INPUT);
    expect(facts).toContain("Longest unanswered run: Panthers, 8 straight");
    expect(facts).toContain("Lead changed hands 5 times.");
    expect(facts).toContain("one-possession game late");
    expect(facts).toContain("Biggest lead: Panthers by 9.");
    expect(facts).toContain("Panthers trailed by as many as 4 and came back.");
    expect(facts).toContain("Panthers went ahead for good at 46-45 in period 2, on Harry Stone's 3-pointer.");
  });

  it("does the running score itself, so the model never has to add up", () => {
    expect(recapFacts(INPUT)).toContain(
      "Score by period: after period 1, Comets led 16-14; after period 2, Panthers led 54-51.",
    );
  });

  it("names each player with their own team, and a sub's real team", () => {
    const facts = recapFacts({
      ...INPUT,
      lines: [...INPUT.lines, line({ name: "Sheldon Ring", teamId: AWAY, pts: 6, subFrom: "Hiltzik's Heroes" })],
    });
    expect(facts).toContain("Harry Stone (Panthers)");
    expect(facts).toContain("Devon Cruz (Comets)");
    expect(facts).toContain("Sheldon Ring (Comets; subbing in from Hiltzik's Heroes)");
  });

  it("adds up each team's totals from the lines", () => {
    expect(recapFacts(INPUT)).toContain("- Panthers: 54 pts, 8/14 FG, 4 reb, 6 ast");
  });

  it("omits shooting splits nobody attempted", () => {
    const facts = recapFacts({
      ...INPUT,
      lines: [line({ name: "Nobody Shot", pts: 0, reb: 5 })],
    });
    expect(facts).not.toContain("3PT");
    expect(facts).not.toContain("FT");
  });

  it("does not talk about periods in a game played as one", () => {
    const facts = recapFacts({ ...INPUT, periodScores: [{ period: 1, home: 54, away: 51 }] });
    expect(facts).not.toContain("period");
    expect(facts).toContain("Panthers went ahead for good at 46-45, on Harry Stone's 3-pointer.");
  });

  it("does not call trailing by one a comeback", () => {
    expect(recapFacts({ ...INPUT, leads: { home: 9, away: 1 } })).not.toContain("came back");
  });

  it("says a tie is a tie", () => {
    const tie = { ...INPUT, away: { ...INPUT.away, score: 54 }, goAhead: null };
    expect(recapFacts(tie)).toContain("FINAL: tied, Panthers 54, Comets 54.");
  });
});

describe("describeLine", () => {
  it("leaves out zeros and gets the plurals right", () => {
    expect(describeLine(line({ pts: 6, reb: 13, ast: 1 }))).toBe("6 points, 13 rebounds and an assist");
  });

  it("does not open with zero points", () => {
    expect(describeLine(line({ reb: 2 }))).toBe("2 rebounds");
  });

  it("says one point, not one points", () => {
    expect(describeLine(line({ pts: 1, stl: 1 }))).toBe("1 point and a steal");
  });
});

describe("playByPlay", () => {
  const names = new Map([
    ["h", "Harry Stone"],
    ["p", "Pat Lee"],
    ["c", "Devon Cruz"],
  ]);

  it("prints the score after each basket and folds in the assist", () => {
    const text = playByPlay(
      [
        ev("fg3_made", HOME, 1, { user_id: "h" }),
        ev("ast", HOME, 1, { user_id: "p" }),
        ev("fg2_made", AWAY, 1, { user_id: "c" }),
      ],
      INPUT,
      names,
    );
    expect(text.split("\n")).toEqual([
      "P1 Harry Stone made a 3-pointer (assist: Pat Lee) | PAN 3, COM 0",
      "P1 Devon Cruz made a 2-pointer | PAN 3, COM 2",
    ]);
  });

  it("credits an assist tapped in before the basket", () => {
    const text = playByPlay(
      [ev("ast", HOME, 1, { user_id: "p" }), ev("fg2_made", HOME, 1, { user_id: "h" })],
      INPUT,
      names,
    );
    expect(text).toBe("P1 Harry Stone made a 2-pointer (assist: Pat Lee) | PAN 2, COM 0");
  });

  it("never credits an assist across teams or on a free throw", () => {
    const text = playByPlay(
      [
        ev("fg2_made", AWAY, 1, { user_id: "c" }),
        ev("ast", HOME, 1, { user_id: "p" }),
        ev("ft_made", HOME, 1, { user_id: "h" }),
      ],
      INPUT,
      names,
    );
    expect(text).not.toContain("assist");
  });

  it("keeps the end of a long game and says what it left off", () => {
    const many = Array.from({ length: 10 }, () => ev("ft_made", HOME, 1, { user_id: "h" }));
    const text = playByPlay(many, INPUT, names, 4);
    expect(text.split("\n")[0]).toBe("(the first 6 scoring plays are left out)");
    expect(text).toContain("PAN 10, COM 0");
  });
});

describe("fallbackRecap", () => {
  it("says who won, how it turned, and who did what", () => {
    const { headline, body } = fallbackRecap(INPUT);
    expect(headline).toBe("Harry Stone scores 21 as Panthers edge Comets");
    expect(body).toContain("Panthers beat Comets 54-51 at Main Gym.");
    expect(body).toContain("Comets led 16-14 at the break.");
    expect(body).toContain("Panthers put together an 8-0 run in period 2.");
    expect(body).toContain(
      "The lead changed hands 5 times before Panthers went ahead for good at 46-45 on Harry Stone's 3-pointer.",
    );
    expect(body).toContain("Harry Stone led Panthers with 21 points, 6 assists and 4 rebounds on 8-of-14 shooting.");
    expect(body).toContain("Devon Cruz had 19 points and 7 rebounds for Comets.");
  });

  it("uses a different verb for a comfortable win", () => {
    const blowout = {
      ...INPUT,
      home: { ...INPUT.home, score: 70 },
      away: { ...INPUT.away, score: 40 },
      lines: [],
    };
    expect(fallbackRecap(blowout).headline).toBe("Panthers pull away from Comets 70-40");
  });

  it("never calls a tie a win", () => {
    const tie = { ...INPUT, away: { ...INPUT.away, score: 54 }, goAhead: null, lines: [] };
    const { headline, body } = fallbackRecap(tie);
    expect(headline).toBe("Panthers and Comets finish level at 54-54");
    expect(body).toContain("played to a 54-54 tie");
    expect(body).not.toContain("beat");
  });

  it("tells a comeback as a comeback", () => {
    const comeback = { ...INPUT, leads: { home: 3, away: 11 } };
    expect(fallbackRecap(comeback).body).toContain("Panthers came back from 11 down to beat Comets 54-51");
  });

  it("says when a sub came from another team", () => {
    const withSub = {
      ...INPUT,
      lines: [
        ...INPUT.lines,
        line({ name: "Sheldon Ring", teamId: HOME, pts: 12, reb: 3, subFrom: "Hiltzik's Heroes" }),
      ],
    };
    expect(fallbackRecap(withSub).body).toContain("Sheldon Ring, in as a sub from Hiltzik's Heroes, added 12 points");
  });

  it("does not credit anyone with zero points", () => {
    const quiet = {
      ...INPUT,
      lines: [...INPUT.lines, line({ name: "Glass Cleaner", teamId: AWAY, reb: 9 })],
    };
    expect(fallbackRecap(quiet).body).not.toContain("0 points");
  });

  it("still produces something for a game with no standouts", () => {
    const bare = { ...INPUT, lines: [], bestRun: null, leadChanges: 0 };
    expect(fallbackRecap(bare).body).toContain("Panthers beat Comets");
  });
});
