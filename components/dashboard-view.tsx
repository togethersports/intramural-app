/**
 * The dashboard, as pure presentation. All data arrives as props so the
 * page can stay a thin data-fetching shell and /design/dashboard can render
 * the whole thing against fixtures with no backend.
 *
 * Structure, in priority order — what a player opens the app to find out:
 *   1. who/when they are (greeting strip, on the Court Blue ground)
 *   2. anything blocking them (action required, the one red moment)
 *   3. their next game (the hero card)
 *   4. how they last played (stat line)
 *   5. where they belong (leagues), then archived, quiet, at the bottom.
 */
import Link from "next/link";
import { restoreLeague, unarchiveLeague } from "@/app/(app)/actions";
import { DemoLeagueButton } from "@/components/demo-league-button";
import { PurgeLeagueForm } from "@/components/purge-league-form";
import {
  IconArrowRight,
  IconCalendar,
  IconChart,
  IconPlus,
  IconTicket,
  IconTrophy,
  IconWhistle,
} from "@/components/icons";
import {
  Button,
  ButtonLink,
  EmptyState,
  FormNotice,
  RoleBadge,
  TeamBadge,
} from "@/components/ui";
import type { LeagueSummary, ShelvedLeague } from "@/lib/leagues";
import { sportLabel } from "@core/league-constants";
import type { GameRow, PlayerGameStatRow } from "@core/types";

export interface DashboardTeam {
  team_id: string;
  team_name: string;
  league_slug: string;
  league_name: string;
  season_id: string;
}

export interface PendingAction {
  kind: "draft" | "availability";
  label: string;
  href: string;
}

export interface DashboardViewProps {
  firstName: string;
  notice?: string | null;
  leagues: LeagueSummary[];
  shelved: ShelvedLeague[];
  myTeams: DashboardTeam[];
  nextGame: (GameRow & { league_slug: string }) | null;
  lastLine: (PlayerGameStatRow & { game: GameRow | null }) | null;
  pending: PendingAction[];
  /** Fixture mode: render the lifecycle forms inert. */
  demo?: boolean;
}

/* --------------------------------- helpers -------------------------------- */

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** "Today", "Tomorrow", "Thu 21 Aug" — a date a student reads at a glance. */
function relativeDay(date: string | null): string {
  if (!date) return "Date TBD";
  const then = new Date(`${date}T00:00:00`);
  const now = new Date();
  const days = Math.round(
    (then.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0)) / 86_400_000,
  );
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1 && days < 7) {
    return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
      weekday: "long",
    });
  }
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function pct(made: number, attempts: number): string {
  return attempts > 0 ? `${Math.round((made / attempts) * 100)}%` : "—";
}

/** Staggered entrance — index drives the delay, capped so a long list
    doesn't leave the last card hanging. */
const rise = (i: number) =>
  ({ "--db-delay": `${Math.min(i, 6) * 60}ms` }) as React.CSSProperties;

/* ------------------------------- sub-sections ------------------------------ */

function NextGameCard({
  game,
  hasTeam,
}: {
  game: (GameRow & { league_slug: string }) | null;
  hasTeam: boolean;
}) {
  if (!game) {
    return (
      <section className="card db-rise flex flex-col p-6 sm:p-7" style={rise(2)}>
        <p className="label">Up next</p>
        <div className="mt-4 flex-1">
          <EmptyState
            icon={<IconCalendar size={26} />}
            title="No games coming up"
            body={
              hasTeam
                ? "You're between games — the league schedule has what's next."
                : "Your games appear here once you're on a team."
            }
          />
        </div>
      </section>
    );
  }

  const live = game.status === "live";
  const sides = [
    {
      name: game.home_team?.name ?? "TBD",
      abbrev: game.home_team?.abbrev ?? "?",
      color: game.home_team?.color ?? "#54749b",
      score: game.home_score,
    },
    {
      name: game.away_team?.name ?? "TBD",
      abbrev: game.away_team?.abbrev ?? "?",
      color: game.away_team?.color ?? "#54749b",
      score: game.away_score,
    },
  ];
  const meta = [
    game.time_slot?.label,
    game.venue?.name,
    game.is_playoff ? "Playoff" : null,
  ].filter(Boolean);

  return (
    <section className="card db-rise flex flex-col p-6 sm:p-7" style={rise(2)}>
      <div className="flex items-center justify-between gap-3">
        <p className="label">Up next</p>
        {live ? (
          <span className="label inline-flex items-center gap-1.5 !text-accent-ink">
            <span className="relative flex size-2">
              <span className="absolute h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative size-2 rounded-full bg-accent" />
            </span>
            Live
          </span>
        ) : (
          <span className="label !text-ink-muted">{relativeDay(game.scheduled_date)}</span>
        )}
      </div>

      <div className="mt-5 space-y-3">
        <div className="flex items-center gap-3.5">
          <TeamBadge abbrev={sides[0].abbrev} color={sides[0].color} size={38} />
          <span className="min-w-0 flex-1 truncate text-[19px] font-semibold tracking-[-0.01em]">
            {sides[0].name}
          </span>
          {live ? (
            <span className="num text-[26px] leading-none">{sides[0].score}</span>
          ) : null}
        </div>
        {/* the matchup reads as one thing, not two stacked rows */}
        <div aria-hidden className="flex items-center gap-3 py-0.5">
          <span className="h-px flex-1 bg-rule" />
          <span className="label !text-[10px] !text-ink-faint">vs</span>
          <span className="h-px flex-1 bg-rule" />
        </div>
        <div className="flex items-center gap-3.5">
          <TeamBadge abbrev={sides[1].abbrev} color={sides[1].color} size={38} />
          <span className="min-w-0 flex-1 truncate text-[19px] font-semibold tracking-[-0.01em]">
            {sides[1].name}
          </span>
          {live ? (
            <span className="num text-[26px] leading-none">{sides[1].score}</span>
          ) : null}
        </div>
      </div>

      {meta.length > 0 ? (
        <p className="label mt-5 border-t border-rule pt-4 !text-[11px]">
          {meta.join(" · ")}
        </p>
      ) : (
        <div className="mt-5 border-t border-rule pt-4" />
      )}

      <div className="mt-4">
        <ButtonLink
          href={`/league/${game.league_slug}/game/${game.id}`}
          variant={live ? "accent" : "primary"}
          className="w-full"
        >
          {live ? "Follow it live" : "Game details"}
        </ButtonLink>
      </div>
    </section>
  );
}

function StatLineCard({
  line,
}: {
  line: (PlayerGameStatRow & { game: GameRow | null }) | null;
}) {
  if (!line?.game) {
    return (
      <section className="card db-rise flex flex-col p-6 sm:p-7" style={rise(3)}>
        <p className="label">Last game</p>
        <div className="mt-4 flex-1">
          <EmptyState
            icon={<IconChart size={26} />}
            title="No stats yet"
            body="Your line shows up the moment your first game is final."
          />
        </div>
      </section>
    );
  }

  const g = line.game;
  const secondary = [
    [line.reb, "REB"],
    [line.ast, "AST"],
    [line.stl, "STL"],
    [line.plus_minus > 0 ? `+${line.plus_minus}` : line.plus_minus, "+/−"],
  ] as const;
  const splits = [
    [`${line.fgm}/${line.fga}`, "FG", pct(line.fgm, line.fga)],
    [`${line.tpm}/${line.tpa}`, "3PT", pct(line.tpm, line.tpa)],
    [`${line.ftm}/${line.fta}`, "FT", pct(line.ftm, line.fta)],
  ] as const;

  return (
    <section className="card db-rise flex flex-col p-6 sm:p-7" style={rise(3)}>
      <p className="label">Last game</p>

      <div className="mt-5">
        <p className="num text-[56px] leading-[0.82] tracking-[-0.02em]">
          {line.pts}
        </p>
        <p className="label mt-2 !text-[11px]">Points</p>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2 border-t border-rule pt-4">
        {secondary.map(([v, k]) => (
          <div key={k}>
            <p className="num text-[21px] leading-none">{v}</p>
            <p className="label mt-1.5 !text-[10px]">{k}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-rule pt-4">
        {splits.map(([made, k, p]) => (
          <div key={k}>
            <p className="label !text-[10px]">{k}</p>
            <p className="num mt-1.5 text-[15px]">
              {made} <span className="text-[13px] text-ink-faint">{p}</span>
            </p>
          </div>
        ))}
      </div>

      <p className="mt-auto truncate pt-4 text-[14px] text-ink-body">
        {g.home_team?.name} <span className="num">{g.home_score}</span> —{" "}
        <span className="num">{g.away_score}</span> {g.away_team?.name}
      </p>
    </section>
  );
}

/* ---------------------------------- view ---------------------------------- */

export function DashboardView({
  firstName,
  notice,
  leagues,
  shelved,
  myTeams,
  nextGame,
  lastLine,
  pending,
  demo = false,
}: DashboardViewProps) {
  const now = new Date();
  const today = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const summary = [
    leagues.length > 0
      ? `${leagues.length} ${leagues.length === 1 ? "league" : "leagues"}`
      : null,
    myTeams[0]?.team_name ?? null,
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      {notice ? <FormNotice message={notice} /> : null}

      {/* Greeting strip — lives directly on the Court Blue ground, no card,
          so the page opens with air instead of another slab. */}
      <header className="db-rise flex flex-wrap items-end justify-between gap-4" style={rise(0)}>
        <div className="min-w-0">
          <p className="label !text-on-canvas/70">{today}</p>
          <h1 className="mt-1.5 text-[clamp(30px,4vw,42px)] font-semibold leading-[1.02] tracking-[-0.03em] text-on-canvas">
            {greeting(now.getHours())}, {firstName}.
          </h1>
          {summary.length > 0 ? (
            <p className="mt-1.5 text-[16px] font-medium text-on-canvas/85">
              {summary.join(" · ")}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2">
          <ButtonLink href="/join" variant="canvas">
            <IconTicket size={18} /> Join
          </ButtonLink>
          <ButtonLink href="/leagues/new" variant="light">
            <IconPlus size={18} /> New league
          </ButtonLink>
        </div>
      </header>

      {/* The one blocking thing, if there is one. */}
      {pending.length > 0 ? (
        <section
          className="card db-rise overflow-hidden"
          style={rise(1)}
          aria-label="Action required"
        >
          <p className="label border-b border-rule px-5 py-3 !text-accent-ink">
            Action required
          </p>
          <ul className="divide-y divide-rule">
            {pending.map((p) => (
              <li key={p.href + p.label}>
                <Link
                  href={p.href}
                  className="db-row flex min-h-14 items-center gap-3.5 px-5 py-3 text-[16px] font-medium"
                >
                  <span className="text-accent-ink">
                    {p.kind === "draft" ? (
                      <IconWhistle size={18} />
                    ) : (
                      <IconCalendar size={18} />
                    )}
                  </span>
                  {/* wraps rather than truncating: which league it's about
                      is the whole point of the line */}
                  <span className="min-w-0 flex-1 leading-snug">{p.label}</span>
                  <IconArrowRight
                    size={16}
                    className="db-arrow shrink-0 text-ink-faint"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <NextGameCard game={nextGame} hasTeam={myTeams.length > 0} />
        <StatLineCard line={lastLine} />
      </div>

      {/* Leagues */}
      <section className="db-rise" style={rise(4)}>
        {leagues.length === 0 ? (
          <div className="card p-6 sm:p-7">
            <EmptyState
              icon={<IconTrophy size={28} />}
              title="You're not in a league yet"
              body="Start one as commissioner, or join with the six-character code from yours."
              action={
                <div className="w-full space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <ButtonLink href="/leagues/new" variant="primary">
                      Start a league
                    </ButtonLink>
                    <ButtonLink href="/join" variant="quiet">
                      I have a code
                    </ButtonLink>
                  </div>
                  <DemoLeagueButton className="max-w-xs" />
                </div>
              }
            />
          </div>
        ) : (
          <>
            <h2 className="label mb-3 px-1 !text-on-canvas/70">My leagues</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {leagues.map((l, i) => {
                const team = myTeams.find((t) => t.league_slug === l.slug);
                return (
                  // min-w-0: a grid item defaults to min-width:auto, so without
                  // it the role badge's min-content width pushed the tile past
                  // the viewport on a phone.
                  <li key={l.id} className="db-rise min-w-0" style={rise(5 + i)}>
                    <Link
                      href={`/league/${l.slug}`}
                      className="card db-tile group flex h-full items-center gap-4 p-4"
                    >
                      <span
                        aria-hidden
                        className="grid size-12 shrink-0 place-items-center rounded-[14px] text-[19px] font-semibold text-white"
                        style={{ backgroundColor: l.primary_color }}
                      >
                        {l.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[17px] font-semibold tracking-[-0.01em]">
                          {l.name}
                        </span>
                        <span className="mt-0.5 block truncate text-[14px] text-ink-muted">
                          {sportLabel(l.sport)}
                          {team ? ` · ${team.team_name}` : ""}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <RoleBadge role={l.role} />
                        <IconArrowRight
                          size={16}
                          className="db-arrow text-ink-faint"
                        />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {/* Archived — deliberately the quietest thing on the page. */}
      {shelved.length > 0 ? (
        <section className="db-rise" style={rise(6)}>
          <h2 className="label mb-3 px-1 !text-on-canvas/60">Archived</h2>
          <ul className="space-y-2">
            {shelved.map((l) => (
              <li
                key={l.id}
                className="card flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
              >
                <div className="min-w-0">
                  {l.deleted_at ? (
                    <p className="truncate text-[16px] font-medium">{l.name}</p>
                  ) : (
                    <Link
                      href={`/league/${l.slug}`}
                      className="truncate text-[16px] font-medium hover:underline"
                    >
                      {l.name}
                    </Link>
                  )}
                  <p className="mt-0.5 text-[13px] text-ink-muted">
                    {l.deleted_at ? (
                      <>
                        Deleted · <span className="num">{l.days_remaining}</span>{" "}
                        {l.days_remaining === 1 ? "day" : "days"} left to restore
                      </>
                    ) : (
                      "Archived — everything kept"
                    )}
                  </p>
                </div>
                {l.role === "commissioner" ? (
                  demo ? (
                    <Button
                      type="button"
                      variant="quiet"
                      disabled
                      className="!min-h-10 !px-4 !py-2 !text-[14px]"
                    >
                      {l.deleted_at ? "Restore" : "Unarchive"}
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <form action={l.deleted_at ? restoreLeague : unarchiveLeague}>
                        <input type="hidden" name="league_id" value={l.id} />
                        <Button
                          type="submit"
                          variant="quiet"
                          className="!min-h-10 !px-4 !py-2 !text-[14px]"
                        >
                          {l.deleted_at ? "Restore" : "Unarchive"}
                        </Button>
                      </form>
                      <PurgeLeagueForm leagueId={l.id} leagueName={l.name} />
                    </div>
                  )
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
