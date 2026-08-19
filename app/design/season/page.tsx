import type { Metadata } from "next";
import Link from "next/link";
import { Lockup } from "@/components/mark";
import { PlayerOfWeekCard, RecapCard } from "@/components/recap-card";
import { ThemeStyle } from "@/components/theme-style";
import { SubPanel } from "@/app/(app)/league/[slug]/subs/sub-panel";
import { SchedulePolls } from "@/app/(app)/league/[slug]/polls/poll-panel";
import type { SchedulePollRow, SubRequestRow } from "@/lib/data";
import { DEFAULT_APPEARANCE, type ThemePreset } from "@core/theme";

export const metadata: Metadata = { title: "Season surfaces — design reference" };

/* The four surfaces added for recaps, awards, subs and scheduling polls,
   against fixture data. The forms are real components wired to real server
   actions — submitting one here just fails an auth check, which is fine;
   this page exists to check how they read, not what they do. */

const HOME = "team-pan";
const AWAY = "team-com";

const RECAP = {
  headline: "Panthers hold on after Comets close it to one",
  body:
    "Panthers beat Comets 54-51 at Main Gym, holding on after leading by as many as nine. The Comets cut it to a single possession in the fourth behind Devon Cruz, who finished with 19 points and 7 rebounds on 7-of-15 shooting, but never got in front. Harry Stone had 21 points, 6 assists and 4 rebounds for the Panthers, and their 8-0 run midway through the second half was the difference. The lead changed hands five times before that.",
  source: "claude",
  created_at: new Date().toISOString(),
};

const AWARD = {
  week: 5,
  user_id: "u-harry",
  team_id: HOME,
  full_name: "Harry Stone",
  team_name: "Panthers",
  headline: "Harry Stone — Week 5",
  blurb:
    "Two games, 39 points and 13 assists, and he did not turn it over once in the second of them. Devon Cruz scored more in a single night; nobody did more across the week.",
  stat_line: { games: 2, pts: 39, reb: 9, ast: 13, stl: 4, blk: 1, fgm: 15, fga: 27 },
  source: "claude",
};

const REQUESTS: SubRequestRow[] = [
  {
    id: "r1",
    game_id: "g1",
    team_id: HOME,
    team_name: "Panthers",
    requested_by: "u-noah",
    absent_user_id: "u-noah",
    absent_name: "Noah Field",
    fill_user_id: "u-leo",
    fill_name: "Leo Tran",
    scope: "league",
    status: "proposed",
    note: "Away at a swim meet",
    decision_note: "",
    created_at: new Date().toISOString(),
  },
  {
    id: "r2",
    game_id: "g1",
    team_id: AWAY,
    team_name: "Comets",
    requested_by: "u-ari",
    absent_user_id: "u-ari",
    absent_name: "Ari Weiss",
    fill_user_id: null,
    fill_name: null,
    scope: "team",
    status: "open",
    note: "",
    decision_note: "",
    created_at: new Date().toISOString(),
  },
  {
    id: "r3",
    game_id: "g1",
    team_id: HOME,
    team_name: "Panthers",
    requested_by: "u-isaac",
    absent_user_id: "u-isaac",
    absent_name: "Isaac Lowe",
    fill_user_id: "u-danny",
    fill_name: "Danny Reiss",
    scope: "league",
    status: "approved",
    note: "Dentist",
    decision_note: "Fine by us",
    created_at: new Date().toISOString(),
  },
];

function isoDay(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

const POLLS: SchedulePollRow[] = [
  {
    id: "p1",
    season_id: "s1",
    game_id: "g9",
    home_team_id: HOME,
    away_team_id: AWAY,
    home_team_name: "Panthers",
    away_team_name: "Comets",
    title: "Week 6 makeup",
    status: "open",
    closes_at: null,
    locked_option_id: null,
    created_at: new Date().toISOString(),
    options: [
      {
        id: "o1",
        scheduled_date: isoDay(4),
        time_slot_id: "sl1",
        slot_label: "Period 4 Lunch",
        venue_id: "v1",
        venue_name: "Main Gym",
        yes: 7,
        maybe: 2,
        no: 1,
        myVote: "yes",
      },
      {
        id: "o2",
        scheduled_date: isoDay(6),
        time_slot_id: "sl2",
        slot_label: "After school",
        venue_id: "v2",
        venue_name: "Aux Gym",
        yes: 3,
        maybe: 4,
        no: 3,
        myVote: null,
      },
    ],
  },
  {
    id: "p2",
    season_id: "s1",
    game_id: "g8",
    home_team_id: AWAY,
    away_team_id: HOME,
    home_team_name: "Comets",
    away_team_name: "Vipers",
    title: "",
    status: "locked",
    closes_at: null,
    locked_option_id: "o3",
    created_at: new Date().toISOString(),
    options: [
      {
        id: "o3",
        scheduled_date: isoDay(1),
        time_slot_id: null,
        slot_label: "Period 5 Lunch",
        venue_id: null,
        venue_name: "Main Gym",
        yes: 9,
        maybe: 0,
        no: 0,
        myVote: "yes",
      },
    ],
  },
];

export default async function SeasonSurfacesPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string }>;
}) {
  const { preset } = await searchParams;
  const chosen: ThemePreset = preset === "sideline" ? "sideline" : "court";

  return (
    <>
      <ThemeStyle appearance={{ ...DEFAULT_APPEARANCE, preset: chosen }} />
      <div className="min-h-screen px-4 py-5 sm:px-6">
        <header className="mx-auto mb-5 flex w-full max-w-5xl flex-wrap items-center justify-between gap-3">
          <Link href="/design" aria-label="Design reference home">
            <Lockup size={32} tone="theme" />
          </Link>
          <div className="flex items-center gap-2">
            {(["court", "sideline"] as const).map((p) => (
              <Link
                key={p}
                href={`/design/season?preset=${p}`}
                className={
                  chosen === p
                    ? "label rounded-full bg-ink px-4 py-2 !text-[10px] !text-on-ink"
                    : "label rounded-full bg-surface px-4 py-2 !text-[10px]"
                }
              >
                {p}
              </Link>
            ))}
          </div>
        </header>

        <div className="mx-auto w-full max-w-5xl space-y-5">
          <RecapCard recap={RECAP} />
          <PlayerOfWeekCard award={AWARD} slug="demo" />

          <SubPanel
            slug="demo"
            gameId="g1"
            homeTeamId={HOME}
            awayTeamId={AWAY}
            teamNames={{ [HOME]: "Panthers", [AWAY]: "Comets" }}
            requests={REQUESTS}
            absences={[
              {
                user_id: "u-noah",
                team_id: HOME,
                reason: "Away at a swim meet",
                full_name: "Noah Field",
              },
            ]}
            viewer={{
              userId: "u-me",
              myTeamId: AWAY,
              captainOf: [AWAY],
              isAdmin: false,
              isAbsent: false,
            }}
            locked={false}
          />

          <SchedulePolls
            slug="demo"
            seasonId="s1"
            polls={POLLS}
            teams={[
              { id: HOME, name: "Panthers" },
              { id: AWAY, name: "Comets" },
            ]}
            slots={[
              { id: "sl1", name: "Period 4 Lunch" },
              { id: "sl2", name: "After school" },
            ]}
            venues={[
              { id: "v1", name: "Main Gym" },
              { id: "v2", name: "Aux Gym" },
            ]}
            canRun
            myTeamIds={[AWAY]}
          />
        </div>
      </div>
    </>
  );
}
