/*
  Seeds the demo league App Review signs into.

  Apple rejects under Guideline 2.1 if a reviewer cannot get past the front
  door, and Intramural's front door is a six-character join code from a
  commissioner. So this builds a league that already has a season, four
  teams, a played-out schedule and real box scores, then prints credentials
  ready to paste into the App Review notes field.

  The reviewer account is a PLAYER, deliberately. Commissioners cannot delete
  their own account while they still run a league (that would strand every
  other member), and a reviewer checking Guideline 5.1.1(v) account deletion
  needs it to simply work.

  Run:  npm run seed:demo
  Needs SUPABASE_SERVICE_ROLE_KEY — it writes as an admin, bypassing RLS.
  Re-running replaces the previous demo league; it touches nothing else.
*/
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

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
      "The service-role key is under Project Settings -> API in Supabase.",
      "It is an admin key: keep it out of git and out of the app. Run as",
      "",
      '  SUPABASE_SERVICE_ROLE_KEY="..." npm run seed:demo',
    ].join("\n"),
  );
  process.exit(1);
}

const db = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const LEAGUE_NAME = "Demo High Intramurals";
const LEAGUE_SLUG = "demo-high-intramurals";
const REVIEWER_EMAIL = process.env.DEMO_EMAIL ?? "appreview@intramural.example";
const PASSWORD = process.env.DEMO_PASSWORD ?? `Review-${randomBytes(6).toString("hex")}`;

/* Same unambiguous alphabet the create_league RPC uses: no I, L, O, 0 or 1. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const joinCode = Array.from(
  { length: 6 },
  () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
).join("");

const TEAMS = [
  { name: "Cardinals", abbrev: "CRD", color: "#B23A48" },
  { name: "Foxes", abbrev: "FOX", color: "#C4703A" },
  { name: "Wolves", abbrev: "WLF", color: "#54749B" },
  { name: "Ravens", abbrev: "RVN", color: "#3E4C59" },
];

const ROSTER = [
  { name: "Alex Reyes", grade: 11 },
  { name: "Jordan Cohen", grade: 12 },
  { name: "Sam Okafor", grade: 10 },
  { name: "Riley Nakamura", grade: 11 },
  { name: "Casey Bloom", grade: 12 },
  { name: "Devin Marsh", grade: 10 },
  { name: "Noor Haddad", grade: 11 },
  { name: "Quinn Alvarez", grade: 12 },
];

const fail = (label, error) => {
  if (!error) return;
  console.error(`\n${label} failed: ${error.message}`);
  process.exit(1);
};

/* Deterministic-looking but varied box score lines. */
const line = (seed) => {
  const pts = 4 + ((seed * 7) % 19);
  const fga = pts + 3 + (seed % 5);
  return {
    pts,
    fgm: Math.max(1, Math.round(pts / 2.4)),
    fga,
    tpm: seed % 3,
    tpa: 1 + (seed % 4),
    ftm: seed % 4,
    fta: seed % 5,
    oreb: seed % 3,
    dreb: 1 + (seed % 6),
    reb: 1 + (seed % 3) + (seed % 6),
    ast: seed % 7,
    stl: seed % 4,
    blk: seed % 3,
    tov: seed % 5,
    pf: seed % 4,
    plus_minus: ((seed * 5) % 21) - 10,
    minutes: 14 + (seed % 12),
  };
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
    await db.auth.admin.updateUserById(id, {
      password: PASSWORD,
      email_confirm: true,
    });
  }

  const { error: profileError } = await db
    .from("profiles")
    .upsert({ id, full_name: fullName, grade }, { onConflict: "id" });
  fail(`Profile for ${email}`, profileError);

  return id;
}

async function main() {
  console.log("Seeding demo league...\n");

  // Start clean. Everything below cascades from the league row.
  const { data: prior } = await db
    .from("leagues")
    .select("id")
    .eq("slug", LEAGUE_SLUG)
    .maybeSingle();
  if (prior) {
    fail("Clearing previous demo", (await db.from("leagues").delete().eq("id", prior.id)).error);
    console.log("  Removed the previous demo league");
  }

  const reviewerId = await upsertUser(REVIEWER_EMAIL, "App Reviewer", 12);
  console.log(`  Reviewer account: ${REVIEWER_EMAIL}`);

  const commissionerId = await upsertUser(
    REVIEWER_EMAIL.replace("@", "+commissioner@"),
    "Dana Whitfield",
    null,
  );

  const playerIds = [];
  for (const [i, p] of ROSTER.entries()) {
    playerIds.push(
      await upsertUser(REVIEWER_EMAIL.replace("@", `+p${i + 1}@`), p.name, p.grade),
    );
  }
  console.log(`  Created ${ROSTER.length} teammates and a commissioner`);

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
        { league_id: league.id, user_id: reviewerId, role: "player" },
        ...playerIds.map((id) => ({
          league_id: league.id,
          user_id: id,
          role: "player",
        })),
      ])
    ).error,
  );

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
      ends_on: iso(28),
      num_weeks: 6,
      status: "active",
    })
    .select("id")
    .single();
  fail("Creating season", seasonError);

  const { data: teams, error: teamsError } = await db
    .from("teams")
    .insert(TEAMS.map((t) => ({ ...t, season_id: season.id })))
    .select("id, name");
  fail("Creating teams", teamsError);

  // Reviewer goes on the first team so their own stat line is on the Home tab.
  const everyone = [reviewerId, ...playerIds];
  const memberships = everyone.map((userId, i) => ({
    team_id: teams[i % teams.length].id,
    user_id: userId,
    jersey_number: 4 + i * 3,
    is_captain: i < teams.length,
  }));
  fail("Filling rosters", (await db.from("team_members").insert(memberships)).error);

  fail(
    "Setting captains",
    (
      await Promise.all(
        teams.map((t, i) =>
          db.from("teams").update({ captain_id: everyone[i] }).eq("id", t.id),
        ),
      )
    ).find((r) => r.error)?.error,
  );

  // Four games already played, two still to come — so standings, box scores
  // and the "next up" card all have something in them.
  const fixtures = [
    { week: 1, home: 0, away: 1, day: -21, hs: 44, as: 38, status: "final" },
    { week: 1, home: 2, away: 3, day: -21, hs: 31, as: 40, status: "final" },
    { week: 2, home: 0, away: 2, day: -14, hs: 52, as: 47, status: "final" },
    { week: 2, home: 1, away: 3, day: -14, hs: 35, as: 36, status: "final" },
    { week: 3, home: 0, away: 3, day: 3, hs: 0, as: 0, status: "scheduled" },
    { week: 3, home: 1, away: 2, day: 5, hs: 0, as: 0, status: "scheduled" },
  ];

  const { data: games, error: gamesError } = await db
    .from("games")
    .insert(
      fixtures.map((f) => ({
        season_id: season.id,
        week: f.week,
        home_team_id: teams[f.home].id,
        away_team_id: teams[f.away].id,
        scheduled_date: iso(f.day),
        status: f.status,
        home_score: f.hs,
        away_score: f.as,
        period: f.status === "final" ? 4 : 0,
      })),
    )
    .select("id, home_team_id, away_team_id, status");
  fail("Creating games", gamesError);

  // Box scores for the finished games only.
  const byTeam = new Map();
  for (const m of memberships) {
    if (!byTeam.has(m.team_id)) byTeam.set(m.team_id, []);
    byTeam.get(m.team_id).push(m.user_id);
  }

  const stats = [];
  let seed = 3;
  for (const g of games.filter((g) => g.status === "final")) {
    for (const teamId of [g.home_team_id, g.away_team_id]) {
      for (const userId of byTeam.get(teamId) ?? []) {
        stats.push({ game_id: g.id, user_id: userId, team_id: teamId, ...line(seed++) });
      }
    }
  }
  fail("Writing box scores", (await db.from("player_game_stats").insert(stats)).error);

  console.log(
    [
      "",
      "Done. Paste this into App Store Connect -> App Review Information -> Notes:",
      "",
      "-".repeat(64),
      "Intramural is used by school sports leagues. Joining a league needs a",
      "six-character code from a commissioner, so please sign in with the demo",
      "account below - it is already on a team in a league with a played",
      "schedule, standings and completed box scores.",
      "",
      `  Email:     ${REVIEWER_EMAIL}`,
      `  Password:  ${PASSWORD}`,
      "",
      `To test joining a second league, the join code is ${joinCode}.`,
      "",
      "Account deletion is in the Me tab: Delete account. It asks to confirm,",
      "then removes the account and all associated data immediately.",
      "-".repeat(64),
      "",
      `League "${LEAGUE_NAME}" - ${teams.length} teams, ${games.length} games, ${stats.length} stat lines.`,
      "",
    ].join("\n"),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
