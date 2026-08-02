/*
  Seeds the demo league App Review signs into, and that the App Store
  screenshots are taken from.

  Apple rejects under Guideline 2.1 if a reviewer cannot get past the front
  door, and Intramural's front door is a six-character join code from a
  commissioner. So this builds a league that is already mid-season: six
  teams, a round-robin schedule with four weeks played and two to come, box
  scores whose player points add up to the final margins, a play-by-play,
  standings with a real spread, availability, rules and an inbox.

  The reviewer account is a PLAYER, deliberately. Commissioners cannot delete
  their own account while they still run a league (that would strand every
  other member), and a reviewer checking Guideline 5.1.1(v) account deletion
  needs it to simply work.

  Run:  npm run seed:demo
  Needs SUPABASE_SERVICE_ROLE_KEY — it writes as an admin, bypassing RLS.
  Re-running replaces the previous demo league; it touches nothing else.

  The pure helpers below are exported so scripts/seed-demo.test.mjs can check
  the schedule and box-score arithmetic without a database.
*/
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** Node doesn't auto-load .env.local the way Next does — fill in anything
    the environment didn't provide (the project URL lives there; the
    service-role key never does, so that one still comes from the shell). */
function loadEnvLocal() {
  try {
    const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m || process.env[m[1]]) continue;
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // no .env.local — the environment must provide everything
  }
}

export const LEAGUE_NAME = "Lincoln High Intramurals";
export const LEAGUE_SLUG = "lincoln-high-intramurals";

const REVIEWER_EMAIL = process.env.DEMO_EMAIL ?? "appreview@intramural.app";
const PASSWORD =
  process.env.DEMO_PASSWORD ?? `Review-${randomBytes(6).toString("hex")}`;

/* Same unambiguous alphabet the create_league RPC uses: no I, L, O, 0 or 1. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/* Seeded so a re-run produces the same league, which keeps a reshoot of one
   screenshot consistent with the others taken earlier. */
let seedState = 20260729;
const rnd = () => {
  seedState |= 0;
  seedState = (seedState + 0x6d2b79f5) | 0;
  let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

export const TEAMS = [
  { name: "Hawks", abbrev: "HWK", color: "#B23A48" },
  { name: "Titans", abbrev: "TTN", color: "#54749B" },
  { name: "Wolves", abbrev: "WLV", color: "#3E4C59" },
  { name: "Falcons", abbrev: "FAL", color: "#C4703A" },
  { name: "Ravens", abbrev: "RVN", color: "#5C5470" },
  { name: "Bulldogs", abbrev: "BUL", color: "#6B7F5E" },
];

/* Six per team. The reviewer takes the first slot, so they play for the
   Hawks and their own stat line is the one on the Home tab. */
export const PLAYERS = [
  "Chris Morgan", "Tyler Brooks", "Marcus Bennett", "Ethan Carter", "Jack Sullivan", "Ryan Mitchell",
  "Cole Anderson", "Blake Harrison", "Owen Fletcher", "Luke Coleman", "Nathan Reed", "Chase Palmer",
  "Dylan Foster", "Mason Gallagher", "Caleb Jennings", "Hunter Wallace", "Trevor Lawson", "Austin Reeves",
  "Grant Whitaker", "Miles Sutton", "Parker Hayes", "Bryce Donovan", "Colin Barrett", "Shane Murphy",
  "Drew Callahan", "Evan Sinclair", "Logan Pierce", "Wyatt Holloway", "Preston Vaughn", "Garrett Nolan",
  "Spencer Riggs", "Xavier Boone", "Tanner Wells", "Reid Stanton", "Julian Cross", "Emmett Ward",
];

const VENUES = [
  { name: "Main Gym", capacity: 2, splittable: true },
  { name: "Auxiliary Gym", capacity: 1, splittable: false },
];

const SLOTS = [
  { label: "Period 4 Lunch", day_of_week: 1, start_time: "11:20", end_time: "12:00", kind: "lunch" },
  { label: "Period 5 Lunch", day_of_week: 2, start_time: "12:05", end_time: "12:45", kind: "lunch" },
  { label: "Period 4 Lunch", day_of_week: 3, start_time: "11:20", end_time: "12:00", kind: "lunch" },
  { label: "Period 5 Lunch", day_of_week: 4, start_time: "12:05", end_time: "12:45", kind: "lunch" },
  { label: "After School", day_of_week: 5, start_time: "15:15", end_time: "16:30", kind: "after_school" },
];

const RULES = `Games are four six-minute periods, running clock except the final minute.

Rosters are six players; five on the court. Every player on the roster must play at least one full period.

Fouls: five personal fouls and you are out. Team fouls over six in a period put the other side in the bonus.

Ties go to a two-minute overtime. A second tie stands as a tie in the standings.

Forfeits are recorded 20-0. Turn up with four players or it is a forfeit.

Standings are decided by win percentage, then head-to-head, then point differential.`;

const PLAYED_THROUGH = 4; // weeks 1-4 played, 5-6 still to come

/* ------------------------------------------------------- pure helpers --- */

/** Circle method: every team plays every other exactly once per cycle. */
export function roundRobin(n) {
  const ids = [...Array(n).keys()];
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) pairs.push([ids[i], ids[n - 1 - i]]);
    rounds.push(pairs);
    ids.splice(1, 0, ids.pop()); // rotate, holding the first fixed
  }
  return rounds;
}

/** A line whose parts reconcile: points equal 2*twos + 3*threes + frees,
 *  and rebounds equal offensive plus defensive. */
export function statLine({ star = false } = {}) {
  const fg3m = star ? pick(2, 4) : pick(0, 2);
  const fg2m = star ? pick(6, 9) : pick(1, 5);
  const ftm = star ? pick(3, 6) : pick(0, 3);
  const oreb = pick(0, 3);
  const dreb = star ? pick(4, 7) : pick(1, 5);
  return {
    pts: fg2m * 2 + fg3m * 3 + ftm,
    fgm: fg2m + fg3m,
    fga: fg2m + fg3m + pick(2, 7),
    tpm: fg3m,
    tpa: fg3m + pick(1, 4),
    ftm,
    fta: ftm + pick(0, 2),
    oreb,
    dreb,
    reb: oreb + dreb,
    ast: star ? pick(4, 7) : pick(0, 4),
    stl: pick(0, 3),
    blk: pick(0, 2),
    tov: pick(0, 4),
    pf: pick(0, 4),
    plus_minus: 0, // set once the margin is known
    minutes: star ? pick(20, 24) : pick(9, 20),
  };
}

/** Six weeks of fixtures; week 6 is a rematch of week 1 with home and away
 *  reversed, which is what a real short season does. */
export function buildFixtures(teamCount) {
  const rounds = roundRobin(teamCount);
  const weeks = [...rounds, rounds[0]];
  const fixtures = [];
  weeks.forEach((pairs, w) => {
    pairs.forEach(([home, away], g) => {
      const flip = w === weeks.length - 1;
      fixtures.push({
        week: w + 1,
        homeIndex: flip ? away : home,
        awayIndex: flip ? home : away,
        venueIndex: g % VENUES.length,
        slotIndex: (w + g) % SLOTS.length,
        dayOffset: (w - PLAYED_THROUGH) * 7 + g,
        final: w < PLAYED_THROUGH,
      });
    });
  });
  return fixtures;
}

/** The reviewer's most recent completed game — the one that supplies the
 *  Home tab's stat line and the play-by-play. */
export function starFixtureIndex(fixtures, teamIndex) {
  for (let i = fixtures.length - 1; i >= 0; i--) {
    const f = fixtures[i];
    if (f.final && (f.homeIndex === teamIndex || f.awayIndex === teamIndex)) return i;
  }
  return -1;
}

/* ------------------------------------------------------------- seeding --- */

let db;

const fail = (label, error) => {
  if (!error) return;
  console.error(`\n${label} failed: ${error.message}`);
  process.exit(1);
};

async function upsertUser(email, fullName, grade) {
  const { data: created, error } = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  let id = created?.user?.id;

  // Already there from a previous run: find them and reset the password so
  // the credentials printed below are always the ones that work.
  if (error) {
    const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
    const existing = list?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (!existing) fail(`Creating ${email}`, error);
    id = existing.id;
    await db.auth.admin.updateUserById(id, { password: PASSWORD, email_confirm: true });
  }

  fail(
    `Profile for ${email}`,
    (await db.from("profiles").upsert({ id, full_name: fullName, grade }, { onConflict: "id" }))
      .error,
  );
  return id;
}

async function main() {
  loadEnvLocal();
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!URL || !SERVICE_KEY) {
    console.error(
      [
        "Missing credentials.",
        "",
        "  NEXT_PUBLIC_SUPABASE_URL   " + (URL ? "found" : "MISSING"),
        "  SUPABASE_SERVICE_ROLE_KEY  " + (SERVICE_KEY ? "found" : "MISSING"),
        "",
        "The service-role key is under Project Settings -> API Keys in Supabase,",
        "the sb_secret_... one behind the Reveal button. It is an admin key:",
        "keep it out of git and out of the app. Run as",
        "",
        '  SUPABASE_SERVICE_ROLE_KEY="sb_secret_..." npm run seed:demo',
      ].join("\n"),
    );
    process.exit(1);
  }

  db = createClient(URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const joinCode = Array.from(
    { length: 6 },
    () => CODE_ALPHABET[Math.floor(rnd() * CODE_ALPHABET.length)],
  ).join("");

  console.log(`Seeding "${LEAGUE_NAME}"...\n`);

  const { data: prior } = await db
    .from("leagues")
    .select("id")
    .eq("slug", LEAGUE_SLUG)
    .maybeSingle();
  if (prior) {
    fail("Clearing previous demo", (await db.from("leagues").delete().eq("id", prior.id)).error);
    console.log("  Removed the previous demo league");
  }

  // ---------------------------------------------------------------- people
  const reviewerId = await upsertUser(REVIEWER_EMAIL, PLAYERS[0], 12);
  const commissionerId = await upsertUser(
    REVIEWER_EMAIL.replace("@", "+coach@"),
    "Coach Dana Whitfield",
    null,
  );

  const playerIds = [reviewerId];
  for (let i = 1; i < PLAYERS.length; i += 6) {
    const chunk = PLAYERS.slice(i, i + 6);
    const ids = await Promise.all(
      chunk.map((name, j) =>
        upsertUser(REVIEWER_EMAIL.replace("@", `+p${i + j}@`), name, pick(9, 12)),
      ),
    );
    playerIds.push(...ids);
  }
  console.log(`  ${playerIds.length} players and a commissioner`);

  // ---------------------------------------------------------------- league
  const { data: league, error: leagueError } = await db
    .from("leagues")
    .insert({
      name: LEAGUE_NAME,
      slug: LEAGUE_SLUG,
      sport: "basketball",
      join_code: joinCode,
      primary_color: "#54749B",
    })
    .select("id")
    .single();
  fail("Creating league", leagueError);

  fail(
    "Adding members",
    (
      await db.from("league_members").insert([
        { league_id: league.id, user_id: commissionerId, role: "commissioner" },
        ...playerIds.map((id, i) => ({
          league_id: league.id,
          user_id: id,
          // One captain per team, and never the reviewer: captains get trade
          // powers that would only distract from the player experience.
          role: i > 0 && i % TEAMS.length === 1 ? "captain" : "player",
        })),
      ])
    ).error,
  );

  const { data: venues, error: venueError } = await db
    .from("venues")
    .insert(VENUES.map((v) => ({ ...v, league_id: league.id })))
    .select("id");
  fail("Creating venues", venueError);

  const { data: slots, error: slotError } = await db
    .from("time_slots")
    .insert(SLOTS.map((s) => ({ ...s, league_id: league.id })))
    .select("id");
  fail("Creating time slots", slotError);

  fail(
    "Writing rules",
    (
      await db
        .from("league_rules")
        .insert({ league_id: league.id, content: RULES, updated_by: commissionerId })
    ).error,
  );

  // ---------------------------------------------------------------- season
  const today = new Date("2026-07-29");
  const iso = (offsetDays) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  };

  const { data: season, error: seasonError } = await db
    .from("seasons")
    .insert({
      league_id: league.id,
      name: "Fall 2026",
      starts_on: iso(-28),
      ends_on: iso(21),
      num_weeks: 6,
      status: "active",
    })
    .select("id")
    .single();
  fail("Creating season", seasonError);

  const { data: teams, error: teamsError } = await db
    .from("teams")
    .insert(TEAMS.map((t) => ({ ...t, season_id: season.id })))
    .select("id, name, abbrev");
  fail("Creating teams", teamsError);

  const roster = teams.map(() => []);
  playerIds.forEach((userId, i) => roster[i % teams.length].push(userId));

  const memberships = [];
  roster.forEach((members, t) => {
    members.forEach((userId, j) => {
      memberships.push({
        team_id: teams[t].id,
        user_id: userId,
        jersey_number: [4, 7, 11, 15, 22, 30][j] ?? 40 + j,
        is_captain: j === 1,
      });
    });
  });
  fail("Filling rosters", (await db.from("team_members").insert(memberships)).error);
  fail(
    "Setting captains",
    (
      await Promise.all(
        teams.map((t, i) => db.from("teams").update({ captain_id: roster[i][1] }).eq("id", t.id)),
      )
    ).find((r) => r.error)?.error,
  );

  // -------------------------------------------------------------- schedule
  const fixtures = buildFixtures(teams.length);
  const reviewerTeam = 0; // playerIds[0] % teams.length
  const starIndex = starFixtureIndex(fixtures, reviewerTeam);

  // Box scores first: a team's score is the sum of what its players scored,
  // so the standings margin and the box score cannot disagree.
  const gameRows = [];
  const statsByFixture = [];

  fixtures.forEach((f, i) => {
    const base = {
      season_id: season.id,
      week: f.week,
      home_team_id: teams[f.homeIndex].id,
      away_team_id: teams[f.awayIndex].id,
      venue_id: venues[f.venueIndex].id,
      time_slot_id: slots[f.slotIndex].id,
      scheduled_date: iso(f.dayOffset),
    };

    if (!f.final) {
      gameRows.push({ ...base, status: "scheduled", home_score: 0, away_score: 0, period: 0 });
      statsByFixture.push(null);
      return;
    }

    const lines = { home: [], away: [] };
    for (const side of ["home", "away"]) {
      const teamIndex = side === "home" ? f.homeIndex : f.awayIndex;
      roster[teamIndex].forEach((userId) => {
        const star = userId === reviewerId && i === starIndex;
        lines[side].push({ userId, teamId: teams[teamIndex].id, ...statLine({ star }) });
      });
    }

    let homeScore = lines.home.reduce((s, l) => s + l.pts, 0);
    const awayScore = lines.away.reduce((s, l) => s + l.pts, 0);
    // A tie would need overtime data to be honest about, so nudge the home
    // side's leading scorer by a basket instead.
    if (homeScore === awayScore) {
      const top = lines.home.reduce((a, b) => (b.pts > a.pts ? b : a));
      top.pts += 2;
      top.fgm += 1;
      top.fga += 1;
      homeScore += 2;
    }

    const margin = homeScore - awayScore;
    lines.home.forEach((l) => (l.plus_minus = margin + pick(-4, 4)));
    lines.away.forEach((l) => (l.plus_minus = -margin + pick(-4, 4)));

    gameRows.push({
      ...base,
      status: "final",
      home_score: homeScore,
      away_score: awayScore,
      period: 4,
      scorekeeper_id: commissionerId,
    });
    statsByFixture.push(lines);
  });

  const { data: games, error: gamesError } = await db
    .from("games")
    .insert(gameRows)
    .select("id, status, week, home_team_id, away_team_id, home_score, away_score");
  fail("Creating games", gamesError);

  const stats = [];
  games.forEach((g, i) => {
    const lines = statsByFixture[i];
    if (!lines) return;
    for (const side of ["home", "away"]) {
      lines[side].forEach(({ userId, teamId, ...rest }) => {
        stats.push({ game_id: g.id, user_id: userId, team_id: teamId, ...rest });
      });
    }
  });
  fail("Writing box scores", (await db.from("player_game_stats").insert(stats)).error);

  // ------------------------------------------------ play-by-play, one game
  // The game screen reads materialised stats for a final game and the event
  // stream for the play-by-play, so the showcase game needs both. Events are
  // generated FROM the box score, so the two agree.
  if (starIndex >= 0) {
    const game = games[starIndex];
    const lines = statsByFixture[starIndex];
    const events = [];
    const PERIOD_MS = 6 * 60 * 1000;

    for (const side of ["home", "away"]) {
      lines[side].forEach((l) => {
        const push = (type, value) =>
          events.push({
            game_id: game.id,
            seq: 0,
            period: pick(1, 4),
            clock_ms: pick(0, PERIOD_MS),
            team_id: l.teamId,
            user_id: l.userId,
            type,
            value: value ?? null,
            created_by: commissionerId,
            client_uuid: randomUUID(),
          });
        for (let k = 0; k < l.tpm; k++) push("fg3_made", 3);
        for (let k = 0; k < l.fgm - l.tpm; k++) push("fg2_made", 2);
        for (let k = 0; k < l.ftm; k++) push("ft_made", 1);
        for (let k = 0; k < l.dreb; k++) push("dreb");
        for (let k = 0; k < l.ast; k++) push("ast");
        for (let k = 0; k < l.stl; k++) push("stl");
      });
    }

    // Chronological: earlier period first, then less time left on the clock.
    events.sort((a, b) => a.period - b.period || b.clock_ms - a.clock_ms);
    events.forEach((e, i) => (e.seq = i));
    fail("Writing play-by-play", (await db.from("game_events").insert(events)).error);

    fail(
      "Writing lineups",
      (
        await db.from("lineup_states").insert(
          ["home", "away"].map((side) => ({
            game_id: game.id,
            seq: 0,
            team_id: lines[side][0].teamId,
            on_court: lines[side].slice(0, 5).map((l) => l.userId),
          })),
        )
      ).error,
    );
  }

  // --------------------------------------------------- availability, inbox
  const availability = [];
  playerIds.forEach((userId, i) => {
    slots.forEach((s, j) => {
      availability.push({
        user_id: userId,
        season_id: season.id,
        time_slot_id: s.id,
        status: ["yes", "yes", "yes", "maybe", "no"][(i + j) % 5],
      });
    });
  });
  fail("Writing availability", (await db.from("availability").insert(availability)).error);

  const starGame = starIndex >= 0 ? games[starIndex] : null;
  const nextGame = games.find((g) => g.status === "scheduled");
  const nameOf = (id) => teams.find((t) => t.id === id)?.name ?? "the other team";
  const starHeadline = starGame
    ? starGame.home_score > starGame.away_score
      ? `${nameOf(starGame.home_team_id)} beat the ${nameOf(starGame.away_team_id)}`
      : `${nameOf(starGame.away_team_id)} beat the ${nameOf(starGame.home_team_id)}`
    : "Final score posted";

  const notifications = [
    {
      category: "final_score",
      title: `${starHeadline}, ${Math.max(starGame?.home_score ?? 0, starGame?.away_score ?? 0)}-${Math.min(starGame?.home_score ?? 0, starGame?.away_score ?? 0)}`,
      body: "Your box score from Thursday is up.",
      link: starGame ? `/league/${LEAGUE_SLUG}/game/${starGame.id}` : null,
      read_at: null,
    },
    {
      category: "schedule_change",
      title: "Week 5 moved to the Main Gym",
      body: "Same period, different court. The auxiliary gym is booked.",
      link: nextGame ? `/league/${LEAGUE_SLUG}/game/${nextGame.id}` : null,
      read_at: null,
    },
    {
      category: "availability_nudge",
      title: "Mark your availability for week 6",
      body: "Two slots still need an answer from you.",
      link: `/league/${LEAGUE_SLUG}/availability`,
      read_at: null,
    },
    {
      category: "scorekeeper",
      title: "You are keeping score on Thursday",
      body: "Falcons against the Ravens, period 5.",
      link: nextGame ? `/league/${LEAGUE_SLUG}/game/${nextGame.id}` : null,
      read_at: new Date("2026-07-27T18:00:00Z").toISOString(),
    },
    {
      category: "trade",
      title: "Trade accepted across the league",
      body: "The Falcons and Ravens swapped a player.",
      link: `/league/${LEAGUE_SLUG}/trades`,
      read_at: new Date("2026-07-25T15:30:00Z").toISOString(),
    },
  ].map((n) => ({ ...n, user_id: reviewerId, league_id: league.id }));
  fail("Writing notifications", (await db.from("notifications").insert(notifications)).error);

  // ---------------------------------------------------------------- output
  const played = games.filter((g) => g.status === "final").length;
  console.log(
    [
      `  ${teams.length} teams, ${games.length} games (${played} played), ${stats.length} stat lines`,
      "",
      "Done. Paste this into App Store Connect -> App Review Information -> Notes:",
      "",
      "-".repeat(68),
      "Intramural is used by school sports leagues. Joining a league needs a",
      "six-character code from a commissioner, so please sign in with the demo",
      "account below - it is already on a team in a league that is mid-season,",
      "with a played schedule, standings, box scores and a play-by-play.",
      "",
      `  Email:     ${REVIEWER_EMAIL}`,
      `  Password:  ${PASSWORD}`,
      "",
      `To test joining a second league, the join code is ${joinCode}.`,
      "",
      "Account deletion is in the Me tab: Delete account. It asks to confirm,",
      "then removes the account and all associated data immediately.",
      "-".repeat(68),
      "",
    ].join("\n"),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
