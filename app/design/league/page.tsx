import type { Metadata } from "next";
import Link from "next/link";
import { GameCard } from "@/components/game-card";
import { IconArrowRight, IconBell, IconGrid, IconPlus } from "@/components/icons";
import { Lockup } from "@/components/mark";
import { StandingsTable } from "@/components/standings-table";
import { Avatar, Panel } from "@/components/ui";
import { ThemeStyle } from "@/components/theme-style";
import { NavIcon } from "@/components/nav-icon";
import { leagueNav } from "@/lib/nav";
import { DEFAULT_APPEARANCE } from "@core/theme";
import type { GameRow } from "@core/types";

export const metadata: Metadata = { title: "League chrome — design reference" };

/* The vocabulary every league surface is built from: the rail, the screen
   header, Panel sections, GameCards, standings rows — drawn in the default
   Court appearance against fixture data. No auth, no database. */

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

const BADGES: Record<string, number> = { trades: 2, inbox: 3 };

export default function LeagueChromeReferencePage() {
  const groups = leagueNav("demo", { admin: true, mode: "player" });

  return (
    <>
      <ThemeStyle appearance={DEFAULT_APPEARANCE} />
      <div className="min-h-screen px-4 py-5 sm:px-6">
        <header className="mx-auto mb-5 flex w-full max-w-[88rem] flex-wrap items-center justify-between gap-3">
          <Link href="/design" aria-label="Design reference home">
            <Lockup size={32} tone="theme" />
          </Link>
          <p className="label">League chrome · fixture data</p>
        </header>

        <div className="mx-auto flex w-full max-w-[88rem] items-start gap-5">
          {/* The rail, exactly as components/shell/shell.tsx draws it. */}
          <aside className="card sticky top-5 hidden h-[calc(100dvh-2.5rem)] w-[248px] shrink-0 flex-col p-3.5 lg:flex">
            <div className="flex items-center gap-2.5 px-1 pb-3.5">
              <span
                aria-hidden
                className="grid size-[38px] shrink-0 place-items-center rounded-[12px] text-[15px] font-semibold text-white"
                style={{ backgroundColor: "#3E5C50" }}
              >
                E
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  Example MS Hoops
                </span>
                <span className="label block truncate !text-[10px]">
                  Winter 2026
                </span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1 rounded-[14px] bg-paper p-1">
              <span className="grid min-h-10 place-items-center rounded-[10px] bg-ink text-[13px] font-semibold text-on-ink">
                Player
              </span>
              <span className="grid min-h-10 place-items-center rounded-[10px] text-[13px] font-semibold text-ink-muted">
                Commish
              </span>
            </div>

            <nav className="-mx-1 mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1">
              {groups.map((group) => (
                <div key={group.label} className="flex flex-col gap-0.5">
                  <p className="label px-2 pb-1.5 !text-[10px] !tracking-[0.18em]">
                    {group.label}
                  </p>
                  {group.items.map((item, i) => {
                    const active = group.label === "This week" && i === 0;
                    const count = item.badge ? (BADGES[item.badge] ?? 0) : 0;
                    return (
                      <span
                        key={item.href}
                        className={
                          active
                            ? "flex min-h-11 items-center gap-2.5 rounded-[11px] bg-paper px-2.5 text-[15px] font-semibold text-ink"
                            : "flex min-h-11 items-center gap-2.5 rounded-[11px] px-2.5 text-[15px] font-medium text-ink-muted"
                        }
                      >
                        <span
                          className={active ? "shrink-0 text-ink" : "shrink-0 text-ink-faint"}
                        >
                          <NavIcon name={item.icon} />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {count > 0 ? (
                          <span className="num grid min-w-5 shrink-0 place-items-center rounded-full bg-accent px-1.5 text-[10px] text-on-accent">
                            {count}
                          </span>
                        ) : null}
                      </span>
                    );
                  })}
                </div>
              ))}
            </nav>

            <div className="mt-3 flex items-center gap-1 border-t border-rule pt-3">
              <span className="flex min-h-10 flex-1 items-center gap-2 rounded-[11px] px-2.5 text-[13px] font-medium text-ink-muted">
                <IconGrid size={17} /> Leagues
              </span>
              <span className="flex min-h-10 flex-1 items-center gap-2 rounded-[11px] px-2.5 text-[13px] font-medium text-ink-muted">
                <IconBell size={17} /> Inbox
                <span className="num ml-auto grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] text-on-accent">
                  3
                </span>
              </span>
            </div>

            <div className="mt-2 flex items-center gap-2 rounded-[14px] bg-paper p-2">
              <Avatar name="Harry Stone" size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold">
                  Harry Stone
                </span>
                <span className="block truncate text-[11px] text-ink-faint">
                  captain · Example MS Hoops
                </span>
              </span>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h1 className="mt-1 truncate text-[clamp(22px,2.6vw,28px)] font-semibold leading-[1.15] tracking-[-0.025em]">
                  Overview
                </h1>
                <p className="mt-1 max-w-[46rem] text-[14.5px] text-ink-body">
                  What&apos;s on, what needs you, and where the season stands.
                </p>
              </div>
              <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-[15px] font-semibold text-on-accent">
                <IconPlus size={16} /> New game
              </span>
            </div>

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

                <Panel eyebrow="Roster" title="3 members" flush>
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
