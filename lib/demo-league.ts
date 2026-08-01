// Content for the in-app demo league: a fixed pool of 60 "ghost" players
// (real auth.users + profiles rows, created once by
// scripts/seed-ghost-players.mjs — see that file) plus the teams, venues,
// slots and rules text loadDemoLeague() assembles them into. Shared across
// every commissioner's demo league; nothing here is written by the app
// itself, only referenced.
//
// This is a different, unrelated demo mechanism from
// scripts/seed-demo.mjs (the single App-Store-review league) — that script
// creates its own real, one-off auth accounts via the Admin API and is
// meant to be run once for App Review. This module backs the self-serve
// "Load demo league" button any commissioner can click from inside the app.

export interface GhostPlayer {
  id: string;
  full_name: string;
  grade: number;
  positions: string[];
}

const POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;
const pos = (...i: number[]) => i.map((n) => POSITIONS[n]);

/** Fixed UUIDs — generated once, never regenerated. Reusing the same ids
    lets every demo league reference the same 60 real accounts instead of
    minting new ones per click. */
const GHOST_NAMES: [string, number, string[]][] = [
  ["Ethan Brooks", 9, pos(0)],
  ["Noah Sinclair", 12, pos(4)],
  ["Liam Foster", 10, pos(1)],
  ["Mason Whitfield", 11, pos(3)],
  ["Lucas Bennett", 8, pos(0)],
  ["Jackson Reyes", 9, pos(2)],
  ["Aiden Coleman", 12, pos(1)],
  ["Elijah Sawyer", 7, pos(0)],
  ["Grayson Holt", 10, pos(4)],
  ["Carter Ellison", 11, pos(3)],
  ["Wyatt Sutton", 9, pos(2)],
  ["Julian Reeves", 12, pos(0)],
  ["Levi Whitaker", 8, pos(1)],
  ["Isaac Donovan", 10, pos(4)],
  ["Owen Fletcher", 11, pos(3)],
  ["Gabriel Hastings", 9, pos(2)],
  ["Anthony Barrett", 12, pos(0, 1)],
  ["Dylan Chambers", 8, pos(4)],
  ["Leo Sheridan", 10, pos(3)],
  ["Lincoln Marsh", 11, pos(2)],
  ["Jaxon Prescott", 9, pos(0)],
  ["Asher Kingston", 12, pos(1)],
  ["Christopher Vance", 7, pos(4)],
  ["Josiah Merrick", 10, pos(3)],
  ["Andrew Calloway", 11, pos(2)],
  ["Thomas Wexford", 9, pos(0)],
  ["Joshua Pemberton", 12, pos(1)],
  ["Ezra Lindqvist", 8, pos(4)],
  ["Hudson Blackwell", 10, pos(3)],
  ["Charles Ashworth", 11, pos(2, 3)],
  ["Caleb Winslow", 9, pos(0)],
  ["Ryan Ferguson", 12, pos(1)],
  ["Nathan Ridgeway", 8, pos(4)],
  ["Adrian Hollis", 10, pos(3)],
  ["Christian Poole", 11, pos(2)],
  ["Isaiah Thornbury", 9, pos(0)],
  ["Colton Abernathy", 12, pos(1)],
  ["Brayden Mackenzie", 7, pos(4)],
  ["Kai Overton", 10, pos(3)],
  ["Easton Radcliffe", 11, pos(2)],
  ["Jason Pruitt", 9, pos(0)],
  ["Ian Castellano", 12, pos(1)],
  ["Cooper Delacroix", 8, pos(4)],
  ["Xavier Montrose", 10, pos(3)],
  ["Roman Ashby", 11, pos(2)],
  ["Silas Kennard", 9, pos(0)],
  ["Axel Whitcombe", 12, pos(1)],
  ["Jace Underwood", 7, pos(4)],
  ["Ezekiel Rosario", 10, pos(3)],
  ["Maverick Stovall", 11, pos(2)],
  ["Beau Lancaster", 9, pos(0)],
  ["Bennett Croft", 12, pos(1)],
  ["Weston Ibarra", 8, pos(4)],
  ["Rhett Callahan", 10, pos(3)],
  ["Nolan Bryce", 11, pos(2)],
  ["Everett Duquesne", 9, pos(0)],
  ["Emmett Solano", 12, pos(1)],
  ["Miles Fairweather", 8, pos(4)],
  ["Griffin Ostrander", 10, pos(3)],
  ["Sawyer Kilbride", 11, pos(2)],
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

export const GHOST_PLAYERS: GhostPlayer[] = GHOST_NAMES.map(
  ([full_name, grade, positions], i) => ({ id: GHOST_IDS[i], full_name, grade, positions }),
);

export interface DemoTeamSeed {
  name: string;
  abbrev: string;
  color: string;
}

export const DEMO_TEAMS: DemoTeamSeed[] = [
  { name: "Panthers", abbrev: "PAN", color: "#3E5C50" },
  { name: "Comets", abbrev: "COM", color: "#54749B" },
  { name: "Vipers", abbrev: "VIP", color: "#6B4C7A" },
  { name: "Grizzlies", abbrev: "GRZ", color: "#7A5230" },
  { name: "Sharks", abbrev: "SHK", color: "#2E6B78" },
  { name: "Rockets", abbrev: "RCK", color: "#B23A48" },
  { name: "Coyotes", abbrev: "CYT", color: "#8C6A3F" },
  { name: "Storm", abbrev: "STM", color: "#454E63" },
];

export const DEMO_VENUES = [
  { name: "Main Gym", capacity: 2, splittable: true },
  { name: "Auxiliary Gym", capacity: 1, splittable: false },
];

export const DEMO_SLOTS = [
  { label: "Period 4 Lunch", day_of_week: 1, start_time: "11:20", end_time: "12:00", kind: "lunch" as const },
  { label: "Period 5 Lunch", day_of_week: 2, start_time: "12:05", end_time: "12:45", kind: "lunch" as const },
  { label: "Period 4 Lunch", day_of_week: 3, start_time: "11:20", end_time: "12:00", kind: "lunch" as const },
  { label: "Free Period 6", day_of_week: 4, start_time: "13:10", end_time: "13:50", kind: "free" as const },
  { label: "After School", day_of_week: 5, start_time: "15:15", end_time: "16:30", kind: "after_school" as const },
];

export const DEMO_RULES = `Games are four eight-minute periods, running clock except the final minute.

Rosters are seven or eight players; five on the court. Every rostered player gets at least one full period.

Fouls: five personal fouls and you are out. Team fouls over six in a period put the other side in the bonus.

Ties go to a three-minute overtime.

Forfeits are recorded 20-0. Turn up with four players or it is a forfeit.

Standings are decided by win percentage, then head-to-head, then point differential.`;

export const DEMO_SEASON_RULES = {
  roster_min: 4,
  roster_max: 8,
  min_players_per_slot: 4,
  max_games_per_team_per_week: 1,
  matchups_per_pair: 1,
  periods: 4,
  period_minutes: 8,
  foul_limit: 5,
  bonus_threshold: 6,
  timeouts_per_team: 4,
  overtime_minutes: 3,
};

export const DEMO_LEAGUE_NAME = "Example Middle School Hoops";
export const DEMO_ORG_NAME = "Example Middle School";
export const DEMO_REGULAR_SEASON_WEEKS = 9;
export const DEMO_PLAYOFF_TEAMS = 4;

/** Deals the 60 ghosts across the 8 teams round-robin so team sizes differ
    by at most one (7 or 8 each), same as a real roster draft would. */
export function distributeRoster(
  players: GhostPlayer[],
  teamCount: number,
): GhostPlayer[][] {
  const rosters: GhostPlayer[][] = Array.from({ length: teamCount }, () => []);
  players.forEach((p, i) => rosters[i % teamCount].push(p));
  return rosters;
}

/** Jersey numbers: a stable, distinctive set per roster slot rather than
    consecutive digits, so a real roster doesn't read as machine-generated. */
export const JERSEY_NUMBERS = [4, 7, 11, 15, 22, 23, 30, 34];
