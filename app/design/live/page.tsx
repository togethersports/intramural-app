import type { Metadata } from "next";
import Link from "next/link";
import { LiveConsole, type TeamSide } from "@/components/live-console";
import { Lockup } from "@/components/mark";
import { DEFAULT_GAME_RULES } from "@core/game-rules";
import type { GameRow } from "@core/types";

export const metadata: Metadata = { title: "Live console — design reference" };

/* Fixture game: Warriors up 22–16 on the Hawks, Q2, clock stopped at 4:12.
   Every prop is static so this page renders with no backend at all. */

const W = "demo-warriors";
const H = "demo-hawks";

const p = (id: string, full_name: string, jersey_number: number) => ({
  id: `tm-${id}`,
  user_id: id,
  full_name,
  jersey_number,
  is_captain: false,
});

const HOME: TeamSide = {
  id: W,
  name: "Warriors",
  abbrev: "WAR",
  color: "#3f5a7c",
  roster: [
    p("carter", "Jake Carter", 4),
    p("bell", "Marcus Bell", 7),
    p("price", "Owen Price", 11),
    p("turner", "Leo Turner", 23),
    p("fisher", "Sam Fisher", 30),
    p("bennett", "Cole Bennett", 12),
    p("palmer", "Drew Palmer", 15),
    p("brooks", "Nate Brooks", 21),
  ],
};

const AWAY: TeamSide = {
  id: H,
  name: "Hawks",
  abbrev: "HWK",
  color: "#54749b",
  roster: [
    p("reed", "Alex Reed", 5),
    p("hayes", "Ryan Hayes", 9),
    p("ward", "Chris Ward", 14),
    p("ross", "Tyler Ross", 20),
    p("cole", "Evan Cole", 32),
    p("foster", "Ben Foster", 8),
    p("morgan", "Jack Morgan", 17),
    p("barnes", "Luke Barnes", 24),
  ],
};

const GAME: GameRow = {
  id: "demo-game",
  season_id: "demo-season",
  week: 4,
  home_team_id: W,
  away_team_id: H,
  venue_id: null,
  time_slot_id: null,
  scheduled_date: null,
  status: "live",
  home_score: 20,
  away_score: 16,
  period: 2,
  clock_ms: 252_000,
  scorekeeper_id: null,
  is_playoff: false,
  bracket_node_id: null,
};

type Ev = [
  period: number,
  clockMs: number,
  type: string,
  user: string | null,
  team: string | null,
  related?: string | null,
  value?: number | null,
];

const SCRIPT: Ev[] = [
  [1, 600_000, "period_start", null, null],
  [1, 561_000, "fg2_made", "carter", W, null, 2],
  [1, 561_000, "ast", "bell", W, "carter"],
  [1, 543_000, "dreb", "reed", H],
  [1, 531_000, "fg2_made", "hayes", H, null, 2],
  [1, 508_000, "fg3_made", "turner", W, null, 3],
  [1, 480_000, "stl", "price", W],
  [1, 472_000, "fg2_miss", "price", W],
  [1, 470_000, "oreb", "fisher", W],
  [1, 468_000, "pf", "ross", H],
  [1, 466_000, "ft_made", "fisher", W, null, 1],
  [1, 464_000, "ft_miss", "fisher", W],
  [1, 430_000, "fg3_made", "reed", H, null, 3],
  [1, 410_000, "to", "bell", W],
  [1, 405_000, "stl", "ward", H],
  [1, 400_000, "fg2_made", "ward", H, null, 2],
  [1, 398_000, "timeout", null, W],
  [1, 398_000, "sub", "bennett", W, "bell"],
  [1, 370_000, "fg2_made", "carter", W, null, 2],
  [1, 342_000, "fg2_miss", "hayes", H],
  [1, 342_000, "blk", "fisher", W],
  [1, 340_000, "dreb", "bennett", W],
  [1, 315_000, "fg3_made", "bennett", W, null, 3],
  [1, 300_000, "pf", "turner", W],
  [1, 298_000, "ft_made", "reed", H, null, 1],
  [1, 296_000, "ft_made", "reed", H, null, 1],
  [1, 0, "period_end", null, null],
  [2, 600_000, "period_start", null, null],
  [2, 588_000, "fg2_made", "hayes", H, null, 2],
  [2, 570_000, "fg2_made", "carter", W, null, 2],
  [2, 545_000, "pf", "ross", H],
  [2, 530_000, "fg2_miss", "reed", H],
  [2, 528_000, "dreb", "turner", W],
  [2, 505_000, "fg3_made", "turner", W, null, 3],
  [2, 470_000, "to", "ward", H],
  [2, 455_000, "fg2_made", "bennett", W, null, 2],
  [2, 452_000, "timeout", null, H],
  [2, 430_000, "fg2_made", "cole", H, null, 2],
  [2, 415_000, "pf", "fisher", W],
  [2, 413_000, "ft_made", "cole", H, null, 1],
  [2, 411_000, "ft_miss", "cole", H],
  [2, 410_000, "oreb", "ross", H],
  [2, 406_000, "fg2_made", "ross", H, null, 2],
  [2, 380_000, "fg2_made", "price", W, null, 2],
  [2, 380_000, "ast", "carter", W, "price"],
];

const EVENTS = SCRIPT.map(([period, clock_ms, type, user, team, related, value], i) => ({
  id: `demo-ev-${i + 1}`,
  seq: i + 1,
  period,
  clock_ms,
  type,
  user_id: user,
  team_id: team,
  related_user_id: related ?? null,
  value: value ?? null,
  client_uuid: `demo-uuid-${i + 1}`,
  voided: false,
}));

const LINEUPS = [
  { seq: 0, team_id: W, on_court: ["carter", "bell", "price", "turner", "fisher"] },
  { seq: 0, team_id: H, on_court: ["reed", "hayes", "ward", "ross", "cole"] },
];

export default function LiveConsoleReferencePage() {
  return (
    <div className="min-h-screen px-4 py-6 sm:px-6">
      <header className="mx-auto mb-6 flex w-full max-w-5xl flex-wrap items-center justify-between gap-3">
        <Link href="/design" aria-label="Design reference home">
          <Lockup size={32} tone="white-red" />
        </Link>
        <p className="label !text-white/80">
          Live console · fixture data · nothing saves
        </p>
      </header>
      <LiveConsole
        slug="demo"
        game={GAME}
        home={HOME}
        away={AWAY}
        serverEvents={EVENTS}
        lineups={LINEUPS}
        rules={DEFAULT_GAME_RULES}
        demo
      />
    </div>
  );
}
