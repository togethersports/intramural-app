/*
  Creates the 60 "ghost" player accounts the in-app "Load demo league"
  button relies on — a fixed, shared pool of real auth.users + profiles
  rows that every commissioner's demo league rosters players from. Nobody
  ever signs in as one; they exist only so team_members/league_members can
  point at a real user_id (both columns are NOT NULL, foreign-keyed to
  auth.users — there is no "display name only" placeholder in the schema).

  This is the ONLY place that creates them. The deployed app never touches
  auth.users and never holds the service-role key — clicking "Load demo
  league" just references these 60 fixed ids (see lib/demo-league.ts) when
  building rosters under the ordinary signed-in commissioner's own session.

  Run ONCE, before anyone clicks "Load demo league" for the first time:

    SUPABASE_SERVICE_ROLE_KEY="sb_secret_..." npm run seed:ghosts

  Safe to re-run — existing ghost accounts (matched by id) are left alone,
  it only creates whichever ones are still missing (e.g. after adding more
  names to the pool later).

  This is unrelated to scripts/seed-demo.mjs (the single App-Store-review
  league with its own one-off, disposable accounts) — do not confuse the
  two. Nothing here is disposable: these ids are hardcoded into
  lib/demo-league.ts and every existing demo league's rosters reference
  them directly.
*/
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
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

// Keep in sync with lib/demo-league.ts — duplicated here so this script has
// no dependency on the Next/TypeScript toolchain and runs with plain node.
const POSITIONS = ["PG", "SG", "SF", "PF", "C"];
const pos = (...i) => i.map((n) => POSITIONS[n]);

const GHOST_NAMES = [
  ["Ethan Brooks", 9, pos(0)], ["Noah Sinclair", 12, pos(4)], ["Liam Foster", 10, pos(1)],
  ["Mason Whitfield", 11, pos(3)], ["Lucas Bennett", 8, pos(0)], ["Jackson Reyes", 9, pos(2)],
  ["Aiden Coleman", 12, pos(1)], ["Elijah Sawyer", 7, pos(0)], ["Grayson Holt", 10, pos(4)],
  ["Carter Ellison", 11, pos(3)], ["Wyatt Sutton", 9, pos(2)], ["Julian Reeves", 12, pos(0)],
  ["Levi Whitaker", 8, pos(1)], ["Isaac Donovan", 10, pos(4)], ["Owen Fletcher", 11, pos(3)],
  ["Gabriel Hastings", 9, pos(2)], ["Anthony Barrett", 12, pos(0, 1)], ["Dylan Chambers", 8, pos(4)],
  ["Leo Sheridan", 10, pos(3)], ["Lincoln Marsh", 11, pos(2)], ["Jaxon Prescott", 9, pos(0)],
  ["Asher Kingston", 12, pos(1)], ["Christopher Vance", 7, pos(4)], ["Josiah Merrick", 10, pos(3)],
  ["Andrew Calloway", 11, pos(2)], ["Thomas Wexford", 9, pos(0)], ["Joshua Pemberton", 12, pos(1)],
  ["Ezra Lindqvist", 8, pos(4)], ["Hudson Blackwell", 10, pos(3)], ["Charles Ashworth", 11, pos(2, 3)],
  ["Caleb Winslow", 9, pos(0)], ["Ryan Ferguson", 12, pos(1)], ["Nathan Ridgeway", 8, pos(4)],
  ["Adrian Hollis", 10, pos(3)], ["Christian Poole", 11, pos(2)], ["Isaiah Thornbury", 9, pos(0)],
  ["Colton Abernathy", 12, pos(1)], ["Brayden Mackenzie", 7, pos(4)], ["Kai Overton", 10, pos(3)],
  ["Easton Radcliffe", 11, pos(2)], ["Jason Pruitt", 9, pos(0)], ["Ian Castellano", 12, pos(1)],
  ["Cooper Delacroix", 8, pos(4)], ["Xavier Montrose", 10, pos(3)], ["Roman Ashby", 11, pos(2)],
  ["Silas Kennard", 9, pos(0)], ["Axel Whitcombe", 12, pos(1)], ["Jace Underwood", 7, pos(4)],
  ["Ezekiel Rosario", 10, pos(3)], ["Maverick Stovall", 11, pos(2)], ["Beau Lancaster", 9, pos(0)],
  ["Bennett Croft", 12, pos(1)], ["Weston Ibarra", 8, pos(4)], ["Rhett Callahan", 10, pos(3)],
  ["Nolan Bryce", 11, pos(2)], ["Everett Duquesne", 9, pos(0)], ["Emmett Solano", 12, pos(1)],
  ["Miles Fairweather", 8, pos(4)], ["Griffin Ostrander", 10, pos(3)], ["Sawyer Kilbride", 11, pos(2)],
];

const GHOST_IDS = [
  "fbb03b28-cddc-461d-ba12-eaf1e69802c0", "ca125c80-a407-4c0f-aa54-2fa66d0a46fd",
  "65943810-8acb-4a92-8675-5aaa267b36d9", "2e5f36ee-21f4-482c-89aa-d4bf03363940",
  "0da8c201-7e3e-42af-b72f-37ba84a4f6c2", "a1c231bf-ea7f-40d7-8d86-ef1715e5b582",
  "f12962e3-1d37-4189-9dba-cea55c2ccf8b", "6f089df5-4dfa-48b1-a16a-257c9285cc9c",
  "1dc0fd1e-4ebe-4f03-a371-61f878ad8cd9", "7afee1ef-e445-415c-9397-1de3e068b24a",
  "2385f201-9ab1-4b31-8af1-5e33350db872", "8743405a-5233-4f2d-bc1e-1beeec7442b4",
  "c321af7e-9cfc-4590-ac8f-b49080481efe", "dffc55a2-324d-4ebc-92cd-cd56e684b17b",
  "565076fb-2452-42a3-83f1-c441e06a71c4", "827227a1-3a11-4337-b077-255749f2a5db",
  "a6b6d391-02db-4c48-9f02-b75caee638ca", "dacacba9-73fd-41aa-97ce-6dc4cdd2f42d",
  "8c944003-6129-46da-b106-98212a2a1ab3", "9ed7ffc5-a90b-4ed9-84f9-67f871fcce78",
  "ab05aa0e-7a84-4da1-b150-46c4f7c3e225", "12069b8e-3f5a-44c3-b349-c45444735d33",
  "1b89f9ba-1307-45ee-ad07-6bc0bb1a138f", "36d290f3-fd2a-4cbb-a604-302016c15063",
  "7880b143-6b44-45c6-a120-e1e09914861e", "cc1ddd8e-b175-43be-b389-fcb5a90f5c47",
  "665b6fe7-e361-4a57-a451-f991473c319f", "f814cebf-e1c0-4220-891d-6489e6ac4d4b",
  "9a33af03-6595-46ec-bd65-573712a77800", "34a64669-efa0-4314-984e-581a6e32d9c6",
  "a0beae36-90fe-42b7-8414-4643af4d89c9", "02c055b4-14d9-48af-b1ab-8a87be9e62b0",
  "803e1aa0-5be4-4c7e-ba3e-8ff25d5c97d0", "544c526b-01c0-4ef5-87d3-f9e236b35f3a",
  "321128d4-177f-4160-be5a-19f41f354396", "e40234e6-1e12-48e6-9e14-76a086632548",
  "39cae481-c8f8-4a59-b343-045ad1dff9cc", "fcfe3b3c-b215-4462-a25d-635afc4445c3",
  "7f74f910-699f-406c-a813-da99b4ca49ef", "454024bc-db96-4e3f-af2c-b9e291239e6d",
  "4775ea03-030a-4938-92b9-cb5bd6b4b7df", "cbf1631a-05b2-4a0b-aa0d-7b2fd9d87436",
  "57505614-65b3-48f0-b88b-6b15ea64519a", "c7d031f3-1198-4444-a638-3e17660d0767",
  "71e6801a-267f-49bf-aaca-d6af8f45e23c", "4eb47738-8ee7-43b8-b74e-5d43713d1b48",
  "bc0c68e0-0fdb-45a5-b39c-3ae896f58895", "383e2868-84d7-4381-ad86-a8c37ac052f4",
  "2da97859-4c2b-4109-86b2-6a0e3afaeedf", "6bc26c50-e2da-4161-af3d-7d3d4f5aa108",
  "ab966593-6278-407e-8cf2-c8ee296e0c45", "150bc10c-68dc-4e3f-9c2d-754187a0c8ff",
  "dac04ae8-bad5-4863-899c-62de3e3bbf9a", "cdd30407-0839-4253-896c-6a780884f3c4",
  "7276cce0-c947-4374-84db-4af20b62754a", "e7e3ff42-922f-4551-969f-00d0493ba666",
  "fcbb8ed8-6666-41b7-ae26-3f485e246638", "72e18223-1db4-46a7-9083-e4fb0f6cc7b7",
  "0ee5f9a0-9095-40e7-9bd7-5c12aec2c6d7", "7727f4d7-6075-4a44-be4d-0fb02d1f37bf",
];

const GHOST_PLAYERS = GHOST_NAMES.map(([full_name, grade, positions], i) => ({
  id: GHOST_IDS[i],
  full_name,
  grade,
  positions,
}));

const fail = (label, error) => {
  if (!error) return;
  console.error(`\n${label} failed: ${error.message}`);
  process.exit(1);
};

async function main() {
  loadEnvLocal();
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !SERVICE_KEY) {
    console.error(
      [
        "Missing credentials.",
        "",
        "  NEXT_PUBLIC_SUPABASE_URL   " + (URL ? "found" : "MISSING — set it, or put it in .env.local"),
        "  SUPABASE_SERVICE_ROLE_KEY  " + (SERVICE_KEY ? "found" : "MISSING"),
        "",
        'Run as  SUPABASE_SERVICE_ROLE_KEY="sb_secret_..." npm run seed:ghosts',
      ].join("\n"),
    );
    process.exit(1);
  }

  const db = createClient(URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Checking ${GHOST_PLAYERS.length} ghost player accounts...\n`);

  const { data: existingList, error: listError } = await db.auth.admin.listUsers({ perPage: 1000 });
  fail("Listing existing users", listError);
  const existingIds = new Set((existingList?.users ?? []).map((u) => u.id));

  let created = 0;
  for (const p of GHOST_PLAYERS) {
    if (existingIds.has(p.id)) continue;
    const email = `${p.id}@ghost.demo.intramural.invalid`;
    const { error } = await db.auth.admin.createUser({
      id: p.id,
      email,
      password: randomBytes(24).toString("hex"),
      email_confirm: true,
      user_metadata: { full_name: p.full_name, grade: p.grade },
    });
    fail(`Creating ${p.full_name}`, error);
    created++;
  }
  console.log(`  Created ${created} new account${created === 1 ? "" : "s"} (${GHOST_PLAYERS.length - created} already existed)`);

  // Profiles are bootstrapped by the on_auth_user_created trigger from
  // user_metadata, but that only sets full_name/grade — positions needs a
  // direct upsert regardless of whether the account was just created.
  fail(
    "Writing positions",
    (
      await db.from("profiles").upsert(
        GHOST_PLAYERS.map((p) => ({
          id: p.id,
          full_name: p.full_name,
          grade: p.grade,
          positions: p.positions,
        })),
        { onConflict: "id" },
      )
    ).error,
  );

  console.log("\nDone. Ghost players are ready — \"Load demo league\" will work in the app now.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
