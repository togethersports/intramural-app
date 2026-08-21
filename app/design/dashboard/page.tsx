import type { Metadata } from "next";
import Link from "next/link";
import { DashboardView } from "@/components/dashboard-view";
import { Lockup } from "@/components/mark";
import type { GameRow, PlayerGameStatRow } from "@core/types";

export const metadata: Metadata = { title: "Dashboard — design reference" };

/* Fixture: a mid-season player in two leagues, with a game tomorrow, a
   played line behind them, and one blocking action. No auth, no backend. */

const NEXT_GAME: GameRow & { league_slug: string } = {
  id: "demo-next",
  season_id: "s1",
  week: 5,
  home_team_id: "t-war",
  away_team_id: "t-hwk",
  venue_id: "v1",
  time_slot_id: "sl1",
  scheduled_date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
  status: "scheduled",
  home_score: 0,
  away_score: 0,
  period: 0,
  clock_ms: null,
  scorekeeper_id: null,
  is_playoff: false,
  is_adhoc: false,
  counts_for_standings: true,
  rules_override: {},
  bracket_node_id: null,
  home_team: { name: "Warriors", abbrev: "WAR", color: "#3f5a7c" },
  away_team: { name: "Hawks", abbrev: "HWK", color: "#B23A48" },
  time_slot: { label: "Period 4 Lunch" },
  venue: { name: "Main Gym" },
  league_slug: "demo",
};

const LAST_GAME: GameRow = {
  ...NEXT_GAME,
  id: "demo-last",
  status: "final",
  home_score: 46,
  away_score: 41,
  scheduled_date: new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10),
};

const LAST_LINE: PlayerGameStatRow & { game: GameRow | null } = {
  game_id: "demo-last",
  user_id: "me",
  team_id: "t-war",
  pts: 18,
  fgm: 7,
  fga: 13,
  tpm: 2,
  tpa: 5,
  ftm: 2,
  fta: 3,
  oreb: 2,
  dreb: 5,
  reb: 7,
  ast: 4,
  stl: 2,
  blk: 1,
  tov: 3,
  pf: 2,
  plus_minus: 6,
  game: LAST_GAME,
};

export default function DashboardReferencePage() {
  return (
    <div className="min-h-screen px-4 py-6 sm:px-6">
      <header className="mx-auto mb-6 flex w-full max-w-6xl flex-wrap items-center justify-between gap-3">
        <Link href="/design" aria-label="Design reference home">
          <Lockup size={32} tone="white-red" />
        </Link>
        <p className="label !text-white/80">Dashboard · fixture data</p>
      </header>
      <div className="mx-auto w-full max-w-6xl">
        <DashboardView
          demo
          firstName="Harry"
          leagues={[
            {
              id: "l1",
              name: "Ramaz Winter Hoops",
              slug: "ramaz-winter-hoops",
              sport: "basketball",
              primary_color: "#c8232c",
              logo_url: null,
              join_code: "XK6KPH",
              role: "commissioner",
            },
            {
              id: "l2",
              name: "Senior S1",
              slug: "senior-s1",
              sport: "basketball",
              primary_color: "#3f5a7c",
              logo_url: null,
              join_code: "PQ4RTM",
              role: "captain",
            },
            {
              id: "l3",
              name: "Faculty Volleyball",
              slug: "faculty-volleyball",
              sport: "volleyball",
              primary_color: "#4E7CA8",
              logo_url: null,
              join_code: "TT9WZA",
              role: "player",
            },
          ]}
          shelved={[
            {
              id: "l4",
              name: "Fall 2025 Hoops",
              slug: "fall-2025-hoops",
              role: "commissioner",
              archived_at: new Date().toISOString(),
              deleted_at: null,
              days_remaining: null,
            },
          ]}
          myTeams={[
            {
              team_id: "t-war",
              team_name: "Warriors",
              league_slug: "ramaz-winter-hoops",
              league_name: "Ramaz Winter Hoops",
              season_id: "s1",
            },
          ]}
          nextGame={NEXT_GAME}
          lastLine={LAST_LINE}
          pending={[
            {
              kind: "availability",
              label: "Fill out availability for Ramaz Winter Hoops",
              href: "#",
            },
          ]}
        />
      </div>
    </div>
  );
}
