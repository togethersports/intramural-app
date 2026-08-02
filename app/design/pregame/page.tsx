import type { Metadata } from "next";
import Link from "next/link";
import { LiveConsole, type TeamSide } from "@/components/live-console";
import { Lockup } from "@/components/mark";
import { DEFAULT_GAME_RULES } from "@core/game-rules";
import type { GameRow } from "@core/types";

export const metadata: Metadata = { title: "Pre-game picker — design reference" };

/* Fixture: a scheduled game, one team with a thin roster and one with none —
   the ad-hoc worst case the picker must handle (add players by name, tap to
   pick starters, tip off). */

const W = "demo-panthers";
const V = "demo-visitors";

const HOME: TeamSide = {
  id: W,
  name: "Panthers",
  abbrev: "PAN",
  color: "#3E5C50",
  roster: [
    { id: "tm-cole", user_id: "cole", full_name: "Evan Cole", jersey_number: 7, is_captain: true },
    { id: "tm-reyes", user_id: "reyes", full_name: "Jackson Reyes", jersey_number: 11, is_captain: false },
    { id: "tm-holt", user_id: "holt", full_name: "Grayson Holt", jersey_number: 21, is_captain: false },
  ],
};

const AWAY: TeamSide = {
  id: V,
  name: "Faculty All-Stars",
  abbrev: "FAC",
  color: "#5A6472",
  roster: [], // visiting team — everyone gets added by name
};

const GAME: GameRow = {
  id: "demo-pregame",
  season_id: "demo-season",
  week: 5,
  home_team_id: W,
  away_team_id: V,
  venue_id: null,
  time_slot_id: null,
  scheduled_date: null,
  status: "scheduled",
  home_score: 0,
  away_score: 0,
  period: 0,
  clock_ms: null,
  scorekeeper_id: null,
  is_playoff: false,
  is_adhoc: true,
  counts_for_standings: false,
  rules_override: {},
  bracket_node_id: null,
};

export default function PregameReferencePage() {
  return (
    <div className="min-h-screen px-4 py-6 sm:px-6">
      <header className="mx-auto mb-6 flex w-full max-w-lg flex-wrap items-center justify-between gap-3">
        <Link href="/design" aria-label="Design reference home">
          <Lockup size={32} tone="white-red" />
        </Link>
        <p className="label !text-white/80">Fixture data · nothing saves</p>
      </header>
      <LiveConsole
        slug="demo"
        game={GAME}
        home={HOME}
        away={AWAY}
        serverEvents={[]}
        lineups={[]}
        rules={DEFAULT_GAME_RULES}
        demo
      />
    </div>
  );
}
