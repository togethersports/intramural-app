import type { Metadata } from "next";
import Link from "next/link";
import { DemoLeagueButton } from "@/components/demo-league-button";
import { GameCard } from "@/components/game-card";
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
  PageHeader,
  RoleBadge,
} from "@/components/ui";
import { restoreLeague, unarchiveLeague } from "@/app/(app)/actions";
import { getMyName, requireUser } from "@/lib/auth";
import {
  getMyLastStatLine,
  getMyNextGame,
  getMyTeams,
} from "@/lib/data";
import { getMyLeagues, getShelvedLeagues, sportLabel } from "@/lib/leagues";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();
  // opportunistic hard-purge of leagues past their 30-day recovery window —
  // no cron on the free tier, and the exact purge hour doesn't matter
  await supabase.rpc("purge_expired_leagues");
  const [name, leagues, shelved, myTeams, nextGame, lastLine] = await Promise.all([
    getMyName(),
    getMyLeagues(),
    getShelvedLeagues(),
    getMyTeams(user.id),
    getMyNextGame(user.id),
    getMyLastStatLine(user.id),
  ]);
  const firstName = name.split(" ")[0];

  // pending actions: live drafts in my leagues + missing availability
  const pending: { label: string; href: string; icon: React.ReactNode }[] = [];
  if (leagues.length > 0) {
    const { data: liveDrafts } = await supabase
      .from("drafts")
      .select("status, season:seasons(league:leagues(slug, name))")
      .eq("status", "live");
    for (const d of liveDrafts ?? []) {
      const season = d.season as unknown as {
        league: { slug: string; name: string } | null;
      } | null;
      if (season?.league) {
        pending.push({
          label: `Draft is LIVE in ${season.league.name}`,
          href: `/league/${season.league.slug}/draft`,
          icon: <IconWhistle size={18} />,
        });
      }
    }
    // one query for all seasons, not one per team
    if (myTeams.length > 0) {
      const { data: myAvailability } = await supabase
        .from("availability")
        .select("season_id")
        .eq("user_id", user.id)
        .in(
          "season_id",
          myTeams.map((t) => t.season_id),
        );
      const filled = new Set((myAvailability ?? []).map((a) => a.season_id));
      for (const team of myTeams) {
        if (!filled.has(team.season_id)) {
          pending.push({
            label: `Fill out availability for ${team.league_name}`,
            href: `/league/${team.league_slug}/availability`,
            icon: <IconCalendar size={18} />,
          });
        }
      }
    }
  }

  return (
    <div className="space-y-5">
      {notice ? <FormNotice message={notice} /> : null}
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        subtitle="Here's where your leagues stand."
        actions={
          <>
            <ButtonLink href="/join" variant="canvas">
              <IconTicket size={18} /> Join
            </ButtonLink>
            <ButtonLink href="/leagues/new" variant="primary">
              <IconPlus size={18} /> Start a league
            </ButtonLink>
          </>
        }
      />

      {pending.length > 0 ? (
        <section className="card border-l-4 border-accent p-4">
          <ul className="space-y-1">
            {pending.map((p) => (
              <li key={p.href + p.label}>
                <Link
                  href={p.href}
                  className="flex min-h-11 items-center gap-3 rounded-panel px-2 font-semibold hover:bg-paper"
                >
                  <span className="text-accent">{p.icon}</span>
                  {p.label}
                  <IconArrowRight size={16} className="ml-auto text-ink-faint" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        {/* Next game */}
        <section className="card p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold tracking-tight">
            Next game
          </h2>
          {nextGame ? (
            <GameCard game={nextGame} slug={nextGame.league_slug} />
          ) : (
            <EmptyState
              icon={<IconCalendar size={26} />}
              title="No games coming up"
              body={
                myTeams.length > 0
                  ? "You're between games — check the league schedule."
                  : "You'll see your games here once you're on a team."
              }
            />
          )}
        </section>

        {/* Last stat line */}
        <section className="card p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold tracking-tight">
            My last stat line
          </h2>
          {lastLine?.game ? (
            <div className="rounded-panel bg-paper p-4">
              <p className="mb-3 text-xs font-medium text-ink-body">
                {lastLine.game.home_team?.name} {lastLine.game.home_score} —{" "}
                {lastLine.game.away_score} {lastLine.game.away_team?.name}
              </p>
              <div className="flex justify-between text-center">
                {[
                  [lastLine.pts, "PTS"],
                  [lastLine.reb, "REB"],
                  [lastLine.ast, "AST"],
                  [lastLine.stl, "STL"],
                  [
                    lastLine.plus_minus > 0
                      ? `+${lastLine.plus_minus}`
                      : lastLine.plus_minus,
                    "+/−",
                  ],
                ].map(([v, label]) => (
                  <div key={label as string}>
                    <p className="num text-3xl">{v}</p>
                    <p className="text-xs font-medium text-ink-faint">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<IconChart size={26} />}
              title="No stats yet"
              body="Your line shows up after your first tracked game."
            />
          )}
        </section>
      </div>

      {/* My leagues */}
      <section className="card p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">My leagues</h2>
        {leagues.length === 0 ? (
          <EmptyState
            icon={<IconTrophy size={28} />}
            title="You're not in a league yet"
            body="Start one as commissioner, or join with the 6-character code from yours."
            action={
              <div className="w-full space-y-4">
                <div className="flex gap-2">
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
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {leagues.map((l) => {
              const team = myTeams.find((t) => t.league_slug === l.slug);
              return (
                <li key={l.id}>
                  <Link
                    href={`/league/${l.slug}`}
                    className="group flex min-h-11 items-center gap-4 rounded-panel bg-paper p-4 transition-colors hover:bg-surface"
                  >
                    <span
                      aria-hidden
                      className="grid size-12 shrink-0 place-items-center rounded-[14px] text-lg font-bold text-white"
                      style={{ backgroundColor: l.primary_color }}
                    >
                      {l.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-semibold">{l.name}</span>
                        <RoleBadge role={l.role} />
                      </span>
                      <span className="text-sm text-ink-body">
                        {sportLabel(l.sport)}
                        {team ? ` · ${team.team_name}` : ""}
                      </span>
                    </span>
                    <IconArrowRight
                      size={18}
                      className="text-ink-faint transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Archived + recently deleted */}
      {shelved.length > 0 ? (
        <section className="card p-5 sm:p-6">
          <h2 className="mb-1 text-lg font-semibold tracking-tight">Archived</h2>
          <p className="mb-4 text-sm text-ink-body">
            Archived leagues keep everything and can come back any time.
            Deleted leagues are restorable until their window runs out.
          </p>
          <ul className="space-y-2">
            {shelved.map((l) => {
              const commissioner = l.role === "commissioner";
              return (
                <li
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-panel bg-paper px-4 py-3"
                >
                  <div className="min-w-0">
                    {l.deleted_at ? (
                      <p className="truncate font-semibold">{l.name}</p>
                    ) : (
                      <Link
                        href={`/league/${l.slug}`}
                        className="truncate font-semibold hover:underline"
                      >
                        {l.name}
                      </Link>
                    )}
                    <p className="text-sm text-ink-body">
                      {l.deleted_at ? (
                        <>
                          Deleted —{" "}
                          <span className="num">{l.days_remaining}</span>{" "}
                          {l.days_remaining === 1 ? "day" : "days"} left to
                          restore
                        </>
                      ) : (
                        "Archived"
                      )}
                    </p>
                  </div>
                  {commissioner ? (
                    <form action={l.deleted_at ? restoreLeague : unarchiveLeague}>
                      <input type="hidden" name="league_id" value={l.id} />
                      <Button type="submit" variant="quiet" className="!min-h-10 !px-4 !py-2 !text-[14px]">
                        {l.deleted_at ? "Restore" : "Unarchive"}
                      </Button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
