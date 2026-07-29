import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { GameCard } from "@/components/game-card";
import { IconArrowRight, IconBall, IconCalendar, IconTrophy } from "@/components/icons";
import { StandingsTable } from "@/components/standings-table";
import { Avatar, EmptyState } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import {
  getActiveSeason,
  getGames,
  getLeague,
  getPosts,
  getSeasonPlayerStats,
  getSeasonStandings,
  getTeams,
} from "@/lib/data";
import { isLeagueAdmin } from "@core/league-constants";
import { aggregateLines, perGame } from "@core/stats";
import { FeedComposer } from "./feed-composer";

function currentWeek(startsOn: string, numWeeks: number): number {
  const start = new Date(`${startsOn}T00:00:00`);
  const diff = Math.floor((Date.now() - start.getTime()) / (7 * 24 * 3600 * 1000));
  return Math.min(Math.max(diff + 1, 1), numWeeks);
}

export default async function LeagueOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();
  const league = await getLeague(slug);
  if (!league) notFound();
  const admin = isLeagueAdmin(league.role);
  const season = await getActiveSeason(league.id);

  if (!season) {
    return (
      <div className="card p-6">
        <EmptyState
          icon={<IconBall size={28} />}
          title="No season yet"
          body={
            admin
              ? "Create a season in the console, add time slots and venues, then draft teams."
              : "The commissioner is still setting up the season."
          }
          action={
            admin ? (
              <Link
                href={`/league/${slug}/console`}
                className="inline-flex min-h-11 items-center gap-2 rounded-control bg-ink px-5 text-[15px] font-medium text-paper"
              >
                Open console <IconArrowRight size={16} />
              </Link>
            ) : undefined
          }
        />
      </div>
    );
  }

  const [games, teams, posts, statRows, standings] = await Promise.all([
    getGames(season.id),
    getTeams(season.id),
    getPosts(league.id, 12),
    getSeasonPlayerStats(season.id),
    getSeasonStandings(season.id),
  ]);

  const week = currentWeek(season.starts_on, season.num_weeks);
  const weekGames = games.filter((g) => g.week === week && !g.is_playoff);
  const displayGames =
    weekGames.length > 0
      ? weekGames
      : games.filter((g) => g.status === "scheduled").slice(0, 4);

  // leaders: PPG, min 1 game
  const byPlayer = new Map<string, { name: string; lines: typeof statRows }>();
  for (const row of statRows) {
    if (!byPlayer.has(row.user_id))
      byPlayer.set(row.user_id, { name: row.full_name ?? "Unnamed", lines: [] });
    byPlayer.get(row.user_id)!.lines.push(row);
  }
  const leaders = [...byPlayer.entries()]
    .map(([userId, { name, lines }]) => {
      const totals = aggregateLines(lines);
      return { userId, name, ppg: perGame(totals.pts, totals.games), games: totals.games };
    })
    .sort((a, b) => b.ppg - a.ppg)
    .slice(0, 3);

  const captainTeam = teams.find((t) => t.captain_id === user.id) ?? null;

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        {/* This week */}
        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">
              {weekGames.length > 0 ? `Week ${week}` : "Upcoming games"}
            </h2>
            <Link
              href={`/league/${slug}/schedule`}
              className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-ink-body hover:text-ink"
            >
              Full schedule <IconArrowRight size={16} />
            </Link>
          </div>
          {displayGames.length === 0 ? (
            <EmptyState
              icon={<IconCalendar size={26} />}
              title="Nothing scheduled yet"
              body={
                admin
                  ? "Generate the schedule from the Schedule tab once availability is in."
                  : "Games will appear once the commissioner builds the schedule."
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {displayGames.map((g) => (
                <GameCard key={g.id} game={g} slug={slug} />
              ))}
            </div>
          )}
        </section>

        {/* Feed */}
        <section className="card p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold tracking-tight">
            League feed
          </h2>
          {admin || captainTeam ? (
            <div className="mb-4">
              <FeedComposer
                leagueId={league.id}
                seasonId={season.id}
                slug={slug}
                captainTeam={captainTeam ? { id: captainTeam.id, name: captainTeam.name } : null}
                admin={admin}
              />
            </div>
          ) : null}
          {posts.length === 0 ? (
            <p className="text-sm text-ink-faint">
              No posts yet. Finals and trades show up here automatically.
            </p>
          ) : (
            <ul className="space-y-3">
              {posts.map((p) => (
                <li key={p.id} className="flex gap-3 rounded-panel bg-paper p-3.5">
                  {p.kind === "auto" ? (
                    <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-full bg-tint text-accent">
                      <IconBall size={16} />
                    </span>
                  ) : (
                    <Avatar name={p.author_name ?? "?"} size={32} className="mt-1" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-ink-faint">
                      {p.kind === "auto"
                        ? "League update"
                        : (p.author_name ?? "Member") +
                          (p.kind === "team" ? " · team post" : "")}
                      {" · "}
                      {new Date(p.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    <p className="text-sm leading-relaxed">{p.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="space-y-5">
        {/* Standings snapshot */}
        <section className="card p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Standings</h2>
            <Link
              href={`/league/${slug}/standings`}
              className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-ink-body hover:text-ink"
            >
              Full <IconArrowRight size={16} />
            </Link>
          </div>
          {standings.rows.length === 0 ? (
            <p className="text-sm text-ink-faint">No teams yet.</p>
          ) : (
            <StandingsTable rows={standings.rows.slice(0, 5)} slug={slug} />
          )}
        </section>

        {/* Scoring leaders */}
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Top scorers</h2>
            <Link
              href={`/league/${slug}/stats`}
              className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-ink-body hover:text-ink"
            >
              Stats <IconArrowRight size={16} />
            </Link>
          </div>
          {leaders.length === 0 ? (
            <p className="text-sm text-ink-faint">
              Leaders appear after the first final.
            </p>
          ) : (
            <ol className="space-y-2.5">
              {leaders.map((l, i) => (
                <li key={l.userId}>
                  <Link
                    href={`/league/${slug}/player/${l.userId}`}
                    className="flex items-center gap-3 hover:underline"
                  >
                    <span className="w-4 text-right text-xs font-semibold text-ink-faint">
                      {i + 1}
                    </span>
                    <Avatar name={l.name} size={30} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {l.name}
                    </span>
                    <span className="num text-lg">{l.ppg.toFixed(1)}</span>
                    <span className="text-xs text-ink-faint">PPG</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Season / invite */}
        <section className="card p-5">
          <h2 className="mb-2 text-lg font-semibold tracking-tight">
            {season.name}
          </h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-body">Week</dt>
              <dd className="tabular font-semibold">
                {week} of {season.num_weeks}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-body">Teams</dt>
              <dd className="tabular font-semibold">{teams.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-body">Status</dt>
              <dd className="font-semibold capitalize">{season.status}</dd>
            </div>
          </dl>
          {admin ? (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-panel bg-paper p-3">
              <div>
                <p className="text-xs font-medium text-ink-body">Join code</p>
                <p className="num font-mono text-xl tracking-[0.25em]">
                  {league.join_code}
                </p>
              </div>
              <CopyButton
                text={league.join_code}
                getText="invite-link"
                label="Invite"
              />
            </div>
          ) : null}
          {season.status === "playoffs" || season.status === "complete" ? (
            <Link
              href={`/league/${slug}/playoffs`}
              className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-control bg-accent text-[15px] font-medium text-white"
            >
              <IconTrophy size={18} /> View bracket
            </Link>
          ) : null}
        </section>
      </div>
    </div>
  );
}
