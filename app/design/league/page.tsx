import type { Metadata } from "next";
import Link from "next/link";
import { GameCard } from "@/components/game-card";
import { IconArrowRight, IconPlus } from "@/components/icons";
import { LeagueNav } from "@/components/league-nav";
import { Lockup } from "@/components/mark";
import { StandingsTable } from "@/components/standings-table";
import { Avatar, Panel } from "@/components/ui";
import type { GameRow } from "@core/types";

export const metadata: Metadata = { title: "League chrome — design reference" };

/* The vocabulary every league tab is built from: identity header, tab
   rail, Panel sections, GameCards, standings rows. Fixture data only.
   (The rail shows no active pill here — nothing matches /design/league.) */

const base: Omit<GameRow, "id" | "status" | "home_score" | "away_score"> = {
  season_id: "s",
  week: 9,
  home_team_id: "a",
  away_team_id: "b",
  venue_id: "v",
  time_slot_id: "t",
  scheduled_date: "2026-07-26",
  period: 4,
  clock_ms: null,
  scorekeeper_id: null,
  is_playoff: false,
  is_adhoc: false,
  counts_for_standings: true,
  rules_override: {},
  bracket_node_id: null,
  home_team: { name: "Coyotes", abbrev: "CYT", color: "#8C6A3F" },
  away_team: { name: "Panthers", abbrev: "PAN", color: "#3E5C50" },
  time_slot: { label: "After school" },
  venue: { name: "Main Gym" },
};

const GAMES: GameRow[] = [
  { ...base, id: "g1", status: "final", home_score: 98, away_score: 104 },
  {
    ...base,
    id: "g2",
    status: "final",
    home_score: 94,
    away_score: 91,
    time_slot: { label: "Period 4 Lunch" },
    home_team: { name: "Rockets", abbrev: "RCK", color: "#B23A48" },
    away_team: { name: "Storm", abbrev: "STM", color: "#454E63" },
  },
  {
    ...base,
    id: "g3",
    status: "live",
    home_score: 41,
    away_score: 38,
    time_slot: { label: "Period 5 Lunch" },
    home_team: { name: "Comets", abbrev: "COM", color: "#54749B" },
    away_team: { name: "Vipers", abbrev: "VIP", color: "#6B4C7A" },
  },
  {
    ...base,
    id: "g4",
    status: "scheduled",
    home_score: 0,
    away_score: 0,
    is_adhoc: true,
    counts_for_standings: false,
    scheduled_date: "2026-08-02",
    time_slot: null,
    home_team: { name: "Panthers", abbrev: "PAN", color: "#3E5C50" },
    away_team: { name: "Faculty All-Stars", abbrev: "FAC", color: "#5A6472" },
  },
];

const ROWS = [
  { teamId: "1", name: "Comets", abbrev: "COM", color: "#54749B", w: 8, l: 1, t: 0, pct: 0.889, pf: 812, pa: 703, diff: 109, streak: "W3", last5: "4-1", gb: 0 },
  { teamId: "2", name: "Vipers", abbrev: "VIP", color: "#6B4C7A", w: 7, l: 2, t: 0, pct: 0.778, pf: 806, pa: 744, diff: 62, streak: "W1", last5: "4-1", gb: 1 },
  { teamId: "3", name: "Panthers", abbrev: "PAN", color: "#3E5C50", w: 7, l: 2, t: 0, pct: 0.778, pf: 790, pa: 733, diff: 57, streak: "L1", last5: "3-2", gb: 1 },
  { teamId: "4", name: "Grizzlies", abbrev: "GRZ", color: "#7A5230", w: 3, l: 6, t: 0, pct: 0.333, pf: 701, pa: 795, diff: -94, streak: "L2", last5: "1-4", gb: 5 },
];

const LEADERS = [
  ["Aiden Coleman", "30.2"],
  ["Liam Foster", "29.8"],
  ["Noah Sinclair", "29.3"],
] as const;

export default function LeagueChromeReferencePage() {
  return (
    <div className="min-h-screen px-4 py-6 sm:px-6">
      <header className="mx-auto mb-6 flex w-full max-w-6xl flex-wrap items-center justify-between gap-3">
        <Link href="/design" aria-label="Design reference home">
          <Lockup size={32} tone="white-red" />
        </Link>
        <p className="label !text-white/80">League chrome · fixture data</p>
      </header>

      <div className="mx-auto w-full max-w-6xl space-y-4">
        {/* identity block, as the league layout renders it */}
        <div className="flex flex-wrap items-end justify-between gap-4 px-1 text-white">
          <div className="flex min-w-0 items-center gap-3.5">
            <span
              aria-hidden
              className="grid size-12 shrink-0 place-items-center rounded-[15px] text-[21px] font-semibold text-white"
              style={{ backgroundColor: "#3E5C50" }}
            >
              E
            </span>
            <div className="min-w-0">
              <p className="label !text-white/70">Basketball · Demo Season</p>
              <h1 className="mt-1 truncate text-[clamp(24px,3vw,34px)] font-semibold leading-[1.05] tracking-[-0.03em]">
                Example Middle School Hoops
              </h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <span className="label rounded-full bg-white/22 px-4 py-2 !text-[11px] !text-white backdrop-blur-sm">
              playoffs
            </span>
            <span className="inline-flex min-h-10 items-center gap-2 rounded-full bg-paper px-5 py-2.5 text-[15px] font-semibold text-ink">
              <IconPlus size={16} /> New game
            </span>
          </div>
        </div>

        <LeagueNav slug="demo" admin />

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <Panel
              eyebrow="Week 9 of 9"
              title="This week"
              action={
                <span className="inline-flex min-h-11 items-center gap-1 text-[15px] font-semibold text-ink-body">
                  Full schedule <IconArrowRight size={16} />
                </span>
              }
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {GAMES.map((g) => (
                  <GameCard key={g.id} game={g} slug="demo" />
                ))}
              </div>
            </Panel>
          </div>

          <div className="space-y-5">
            <Panel
              title="Standings"
              action={
                <span className="inline-flex min-h-11 items-center gap-1 text-[15px] font-semibold text-ink-body">
                  Full <IconArrowRight size={16} />
                </span>
              }
            >
              <StandingsTable rows={ROWS} slug="demo" />
            </Panel>

            <Panel title="Top scorers">
              <ol className="space-y-2.5">
                {LEADERS.map(([name, ppg], i) => (
                  <li key={name} className="flex items-center gap-3">
                    <span className="num w-4 text-right text-[12px] text-ink-faint">
                      {i + 1}
                    </span>
                    <Avatar name={name} size={30} />
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                      {name}
                    </span>
                    <span className="num text-[17px]">{ppg}</span>
                    <span className="label !text-[10px]">PPG</span>
                  </li>
                ))}
              </ol>
            </Panel>

            <Panel
              eyebrow="Roster"
              title="3 members"
              flush
            >
              <div className="divide-y divide-rule">
                {["Aiden Coleman", "Liam Foster", "Noah Sinclair"].map((n) => (
                  <div key={n} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                    <Avatar name={n} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{n}</p>
                      <p className="text-sm text-ink-body">Grade 11</p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel eyebrow="Season" title="Demo Season">
              <dl className="space-y-2 text-[15px]">
                {[
                  ["Week", "9 of 9"],
                  ["Teams", "8"],
                  ["Status", "Playoffs"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <dt className="text-ink-body">{k}</dt>
                    <dd className="num font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
