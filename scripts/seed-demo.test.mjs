/*
  Checks the demo seed's arithmetic without touching a database. The seed
  runs against a live Supabase project, so a mistake in the schedule or the
  box scores would otherwise only surface as a wrong-looking screenshot —
  after 36 accounts had already been created.
*/
import assert from "node:assert/strict";
import test from "node:test";
import {
  PLAYERS,
  TEAMS,
  buildFixtures,
  roundRobin,
  starFixtureIndex,
  statLine,
} from "./seed-demo.mjs";

test("rosters divide evenly across the teams", () => {
  assert.equal(PLAYERS.length % TEAMS.length, 0);
  assert.equal(PLAYERS.length / TEAMS.length, 6);
});

test("round robin pairs every team exactly once per cycle", () => {
  const rounds = roundRobin(TEAMS.length);
  assert.equal(rounds.length, TEAMS.length - 1);

  const seen = new Set();
  for (const round of rounds) {
    assert.equal(round.length, TEAMS.length / 2);
    // Nobody plays twice in the same week.
    const playing = round.flat();
    assert.equal(new Set(playing).size, playing.length);
    for (const [a, b] of round) {
      const key = [a, b].sort().join("-");
      assert.ok(!seen.has(key), `${key} scheduled twice`);
      seen.add(key);
    }
  }
  // Every possible pairing is used: 6 teams -> 15 distinct matchups.
  assert.equal(seen.size, (TEAMS.length * (TEAMS.length - 1)) / 2);
});

test("six weeks, four of them played, three games each", () => {
  const fixtures = buildFixtures(TEAMS.length);
  assert.equal(fixtures.length, 18);
  assert.equal(fixtures.filter((f) => f.final).length, 12);

  for (let week = 1; week <= 6; week++) {
    assert.equal(fixtures.filter((f) => f.week === week).length, 3);
  }
  // Played games are dated in the past, upcoming ones in the future.
  for (const f of fixtures) {
    if (f.final) assert.ok(f.dayOffset < 0, `week ${f.week} played but dated ahead`);
    else assert.ok(f.dayOffset >= 0, `week ${f.week} upcoming but dated behind`);
  }
});

test("the last week reverses home and away from the first", () => {
  const fixtures = buildFixtures(TEAMS.length);
  const first = fixtures.filter((f) => f.week === 1);
  const last = fixtures.filter((f) => f.week === 6);
  last.forEach((f, i) => {
    assert.equal(f.homeIndex, first[i].awayIndex);
    assert.equal(f.awayIndex, first[i].homeIndex);
  });
});

test("the reviewer's showcase game is one their team played", () => {
  const fixtures = buildFixtures(TEAMS.length);
  const i = starFixtureIndex(fixtures, 0);
  assert.ok(i >= 0, "no completed game found for the reviewer's team");
  const f = fixtures[i];
  assert.ok(f.final);
  assert.ok(f.homeIndex === 0 || f.awayIndex === 0);
  // And it is the most recent one, so it matches the Home tab's "last line".
  const later = fixtures
    .slice(i + 1)
    .some((x) => x.final && (x.homeIndex === 0 || x.awayIndex === 0));
  assert.ok(!later, "a later completed game exists for that team");
});

test("box score components reconcile with the points", () => {
  for (let i = 0; i < 400; i++) {
    const l = statLine({ star: i % 7 === 0 });
    const twos = l.fgm - l.tpm;
    assert.equal(l.pts, twos * 2 + l.tpm * 3 + l.ftm, "points do not match the shots");
    assert.equal(l.reb, l.oreb + l.dreb, "rebounds do not match off + def");
    assert.ok(l.fgm <= l.fga, "more makes than attempts");
    assert.ok(l.tpm <= l.tpa, "more threes made than attempted");
    assert.ok(l.ftm <= l.fta, "more free throws made than attempted");
    assert.ok(l.tpm <= l.fgm, "threes counted outside field goals");
    assert.ok(l.minutes > 0);
  }
});

test("a star line outscores an ordinary one", () => {
  const ordinary = Array.from({ length: 60 }, () => statLine().pts);
  const star = Array.from({ length: 60 }, () => statLine({ star: true }).pts);
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  assert.ok(mean(star) > mean(ordinary) + 8, "the Home tab line will not stand out");
});
