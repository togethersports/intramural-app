/*
  Applies every migration to an in-memory Postgres (PGlite) with a stubbed
  Supabase auth schema, then runs a full league scenario:
  create → join → season → teams → draft → availability → game events →
  finalize-ish writes → trade. Fails loudly on any SQL error.

  Run with: npm run test:db
  Note: runs as superuser, so RLS policies are validated for syntax, not
  enforcement.
*/
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const db = new PGlite();
let failures = 0;

async function exec(label, sql) {
  try {
    return await db.exec(sql);
  } catch (err) {
    failures++;
    console.error(`✗ ${label}: ${err.message}`);
    throw err;
  }
}

async function one(sql, params = []) {
  const res = await db.query(sql, params);
  return res.rows[0];
}

function assert(cond, label) {
  if (cond) {
    console.log(`✓ ${label}`);
  } else {
    failures++;
    console.error(`✗ ASSERTION FAILED: ${label}`);
  }
}

const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
async function actAs(n) {
  await db.query(`select set_config('app.uid', $1, false)`, [uid(n)]);
}

// ---------------------------------------------------------- supabase stubs
await exec(
  "auth stub",
  `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
`,
);

// ------------------------------------------------------------- migrations
const dir = new URL("../supabase/migrations", import.meta.url).pathname;
for (const file of readdirSync(dir).sort()) {
  await exec(`migration ${file}`, readFileSync(join(dir, file), "utf8"));
  console.log(`✓ applied ${file}`);
}

// --------------------------------------------------------------- scenario
// users: 1 = commissioner, 2..3 captains, 4..9 players
for (let n = 1; n <= 9; n++) {
  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data)
     values ($1, $2, jsonb_build_object('full_name', $3::text, 'grade', '11'))`,
    [uid(n), `user${n}@school.org`, `Player Number${n}`],
  );
}
assert(
  (await one(`select count(*)::int as c from profiles`)).c === 9,
  "profile bootstrap trigger created 9 profiles",
);

await actAs(1);
const slug = (await one(`select create_league('Test Hoops', 'basketball', '#c8232c', 'Test School') as s`)).s;
assert(typeof slug === "string" && slug.startsWith("test-hoops"), `create_league → ${slug}`);
const league = await one(`select * from leagues where slug = $1`, [slug]);
assert(league.join_code.length === 6, `join code generated: ${league.join_code}`);

for (let n = 2; n <= 9; n++) {
  await actAs(n);
  await one(`select join_league_with_code($1) as s`, [league.join_code]);
}
assert(
  (await one(`select count(*)::int as c from league_members where league_id = $1 and status = 'active'`, [league.id])).c === 9,
  "9 active members after joins",
);

// captains
await actAs(1);
await db.query(`update league_members set role = 'captain' where user_id in ($1, $2)`, [uid(2), uid(3)]);

// season + slots + venue
const season = await one(
  `insert into seasons (league_id, name, starts_on, ends_on, num_weeks, rules)
   values ($1, 'Winter 2026', '2026-01-05', '2026-03-01', 6,
           '{"roster_min":2,"roster_max":6}'::jsonb)
   returning *`,
  [league.id],
);
const slotA = await one(
  `insert into time_slots (league_id, label, day_of_week, start_time, end_time, kind)
   values ($1, 'Lunch A', 1, '11:40', '12:10', 'lunch') returning *`,
  [league.id],
);
const slotB = await one(
  `insert into time_slots (league_id, label, day_of_week, start_time, end_time, kind)
   values ($1, 'Free 6', 3, '13:30', '14:10', 'free') returning *`,
  [league.id],
);
const venue = await one(
  `insert into venues (league_id, name) values ($1, 'Main Gym') returning *`,
  [league.id],
);

// teams with captains on roster
const teamA = await one(
  `insert into teams (season_id, name, abbrev, captain_id) values ($1, 'Warriors', 'WAR', $2) returning *`,
  [season.id, uid(2)],
);
const teamB = await one(
  `insert into teams (season_id, name, abbrev, captain_id) values ($1, 'Hawks', 'HWK', $2) returning *`,
  [season.id, uid(3)],
);
await db.query(
  `insert into team_members (team_id, user_id, is_captain) values ($1, $2, true), ($3, $4, true)`,
  [teamA.id, uid(2), teamB.id, uid(3)],
);

// ------------------------------------------------------------------ draft
const draft = await one(
  `insert into drafts (season_id, format, pick_seconds, rounds, pick_order, status, last_pick_at)
   values ($1, 'snake', 60, 3, jsonb_build_array($2::text, $3::text), 'live', now())
   returning *`,
  [season.id, teamA.id, teamB.id],
);

// snake order: pick1 A, pick2 B, pick3 B, pick4 A ...
const p1 = await one(`select draft_pick_team($1, 1) as t`, [draft.id]);
const p2 = await one(`select draft_pick_team($1, 2) as t`, [draft.id]);
const p3 = await one(`select draft_pick_team($1, 3) as t`, [draft.id]);
const p4 = await one(`select draft_pick_team($1, 4) as t`, [draft.id]);
assert(p1.t === teamA.id && p2.t === teamB.id, "snake round 1 order A, B");
assert(p3.t === teamB.id && p4.t === teamA.id, "snake round 2 reverses to B, A");

// captain queue for team B
await actAs(3);
await db.query(
  `insert into draft_queues (draft_id, team_id, user_id, rank) values ($1, $2, $3, 1)`,
  [draft.id, teamB.id, uid(7)],
);

// captain A picks user 4
await actAs(2);
await db.query(`select make_pick($1, $2)`, [draft.id, uid(4)]);
assert(
  (await one(`select count(*)::int as c from team_members where team_id = $1 and left_at is null`, [teamA.id])).c === 2,
  "pick 1 put player on Warriors roster",
);
assert(
  (await one(`select count(*)::int as c from notifications where user_id = $1 and category = 'draft_clock'`, [uid(3)])).c === 1,
  "next captain got an on-the-clock notification",
);

// wrong captain cannot pick (still acting as captain A, but it's B's turn)
let blocked = false;
try {
  await db.query(`select make_pick($1, $2)`, [draft.id, uid(5)]);
} catch {
  blocked = true;
}
assert(blocked, "captain A blocked from picking on B's turn");

// captain B takes pick 2
await actAs(3);
await db.query(`select make_pick($1, $2)`, [draft.id, uid(6)]);

// clock not expired: auto_pick refuses
await db.query(`update drafts set last_pick_at = now() where id = $1`, [draft.id]);
let refused = false;
try {
  await db.query(`select auto_pick($1)`, [draft.id]);
} catch {
  refused = true;
}
assert(refused, "auto_pick refuses while clock is running");

// expire the clock → queue pick fires for team B again (snake pick 3)
await db.query(`update drafts set last_pick_at = now() - interval '2 minutes' where id = $1`, [draft.id]);
await actAs(5);
await db.query(`select auto_pick($1)`, [draft.id]);
const q = await one(
  `select user_id, auto_picked from draft_picks where draft_id = $1 and pick_no = 3`,
  [draft.id],
);
assert(q.user_id === uid(7) && q.auto_picked === true, "auto_pick took the queued player");

// undo + repick
await actAs(1);
await db.query(`select undo_last_pick($1)`, [draft.id]);
assert(
  (await one(`select current_pick_no from drafts where id = $1`, [draft.id])).current_pick_no === 3,
  "undo rewinds the pick counter",
);
await actAs(3);
await db.query(`select make_pick($1, $2)`, [draft.id, uid(7)]);
// finish the draft: pick 4 (A), pick 5 (A, auto), pick 6 (B, auto → complete)
await actAs(2);
await db.query(`select make_pick($1, $2)`, [draft.id, uid(5)]);
await db.query(`update drafts set last_pick_at = now() - interval '2 minutes' where id = $1`, [draft.id]);
await db.query(`select auto_pick($1)`, [draft.id]);
await db.query(`update drafts set last_pick_at = now() - interval '2 minutes' where id = $1`, [draft.id]);
await db.query(`select auto_pick($1)`, [draft.id]);
assert(
  (await one(`select status from drafts where id = $1`, [draft.id])).status === "complete",
  "draft completes after rounds × teams picks",
);

// ------------------------------------------------------------ availability
await actAs(4);
await db.query(
  `insert into availability (user_id, season_id, time_slot_id, status)
   values ($1, $2, $3, 'yes'), ($1, $2, $4, 'no')
   on conflict (user_id, season_id, time_slot_id) do update set status = excluded.status`,
  [uid(4), season.id, slotA.id, slotB.id],
);
assert(
  (await one(`select count(*)::int as c from availability where season_id = $1`, [season.id])).c === 2,
  "availability upserts",
);

// ------------------------------------------------------------------- game
await actAs(1);
const game = await one(
  `insert into games (season_id, week, home_team_id, away_team_id, venue_id, time_slot_id, scheduled_date, status, scorekeeper_id)
   values ($1, 1, $2, $3, $4, $5, '2026-01-05', 'live', $6) returning *`,
  [season.id, teamA.id, teamB.id, venue.id, slotA.id, uid(2)],
);

await actAs(2); // scorekeeper
const ev = (type, user, team, seq, extra = {}) =>
  db.query(
    `insert into game_events (game_id, seq, period, type, user_id, team_id, created_by, client_uuid, value, related_user_id)
     values ($1, $2, 1, $3, $4, $5, $6, $7, $8, $9)`,
    [game.id, seq, type, user, team, uid(2), crypto.randomUUID(), extra.value ?? null, extra.related ?? null],
  );
await ev("fg2_made", uid(4), teamA.id, 1, { value: 2 });
await ev("ast", uid(2), teamA.id, 2, { related: uid(4) });
await ev("fg3_made", uid(3), teamB.id, 3, { value: 3 });

// duplicate client_uuid is rejected (idempotent sync)
const dupId = crypto.randomUUID();
await db.query(
  `insert into game_events (game_id, seq, period, type, created_by, client_uuid)
   values ($1, 10, 1, 'timeout', $2, $3)`,
  [game.id, uid(2), dupId],
);
let dupBlocked = false;
try {
  await db.query(
    `insert into game_events (game_id, seq, period, type, created_by, client_uuid)
     values ($1, 11, 1, 'timeout', $2, $3)`,
    [game.id, uid(2), dupId],
  );
} catch {
  dupBlocked = true;
}
assert(dupBlocked, "duplicate client_uuid rejected (offline sync idempotency)");

// stat line write (what finalize does)
await db.query(
  `insert into player_game_stats (game_id, user_id, team_id, pts, fgm, fga, reb, ast, plus_minus)
   values ($1, $2, $3, 2, 1, 1, 0, 0, -1)
   on conflict (game_id, user_id) do update set pts = excluded.pts`,
  [game.id, uid(4), teamA.id],
);
await db.query(`update games set status = 'final', home_score = 2, away_score = 3 where id = $1`, [game.id]);
assert(
  (await one(`select status from games where id = $1`, [game.id])).status === "final",
  "game finalizes",
);

// ------------------------------------------------------------------ trade
await actAs(2);
const tradeId = (
  await one(`select propose_trade($1, $2, $3, $4, $5, 'need shooting') as id`, [
    season.id,
    teamA.id,
    teamB.id,
    `{${uid(4)}}`,
    `{${uid(7)}}`,
  ])
).id;
assert(!!tradeId, "trade proposed");
assert(
  (await one(`select count(*)::int as c from notifications where user_id = $1 and category = 'trade'`, [uid(3)])).c >= 1,
  "counterparty captain notified",
);

await actAs(3);
await db.query(`select respond_trade($1, true)`, [tradeId]);
assert(
  (await one(`select status from trades where id = $1`, [tradeId])).status === "accepted",
  "trade accepted, waiting on commissioner (default approval mode)",
);

await actAs(1);
await db.query(`select resolve_trade($1, true)`, [tradeId]);
assert(
  (await one(`select status from trades where id = $1`, [tradeId])).status === "executed",
  "commissioner approval executes the trade",
);
const moved = await one(
  `select count(*)::int as c from team_members where team_id = $1 and user_id = $2 and left_at is null`,
  [teamB.id, uid(4)],
);
assert(moved.c === 1, "offered player now on the other roster");
assert(
  (await one(`select count(*)::int as c from posts where kind = 'auto' and league_id = $1`, [league.id])).c >= 1,
  "auto feed post about the trade",
);

// ---------------------------------------------------------------- summary
if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nAll database scenario checks passed.");
