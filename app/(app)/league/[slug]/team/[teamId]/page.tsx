import Link from "next/link";
import { notFound } from "next/navigation";
import { GameCard } from "@/components/game-card";
import { Avatar, StatTile, TeamBadge, Panel } from "@/components/ui";
import { getUser } from "@/lib/auth";
import {
  getActiveSeason,
  getGames,
  getLeague,
  getSeasonPlayerStats,
  getSeasonStandings,
  getTeamsWithRosters,
} from "@/lib/data";
import { isLeagueAdmin } from "@core/league-constants";
import { aggregateLines, perGame } from "@core/stats";
import { LineupEditor, TeamCardEditor } from "./team-editor";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ slug: string; teamId: string }>;
}) {
  const { slug, teamId } = await params;
  const league = await getLeague(slug);
  if (!league) notFound();
  const season = await getActiveSeason(league.id);
  if (!season) notFound();
  const jerseys = league.settings?.jersey_numbers !== false;

  const [user, teams, games, standings, statRows] = await Promise.all([
    getUser(),
    getTeamsWithRosters(season.id),
    getGames(season.id),
    getSeasonStandings(season.id),
    getSeasonPlayerStats(season.id),
  ]);
  const team = teams.find((t) => t.id === teamId);
  if (!team) notFound();

  // A captain runs their own team card and lineup; a commissioner can run
  // any of them. Everyone else sees the same page, read-only.
  const canManage =
    isLeagueAdmin(league.role) ||
    (user != null &&
      (team.captain_id === user.id ||
        team.roster.some((m) => m.user_id === user.id && m.is_captain)));

  const row = standings.rows.find((r) => r.teamId === teamId);
  const rank = standings.rows.findIndex((r) => r.teamId === teamId) + 1;
  const teamGames = games.filter(
    (g) => g.home_team_id === teamId || g.away_team_id === teamId,
  );

  // per-player season averages for this team
  const byPlayer = new Map<string, typeof statRows>();
  for (const r of statRows.filter((r) => r.team_id === teamId)) {
    if (!byPlayer.has(r.user_id)) byPlayer.set(r.user_id, []);
    byPlayer.get(r.user_id)!.push(r);
  }

  return (
    <div className="space-y-5">
      <section className="card flex flex-wrap items-center justify-between gap-4 p-7">
        <div className="flex items-center gap-4">
          {team.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={team.logo_url}
              alt=""
              className="size-[52px] shrink-0 rounded-[14px] object-cover"
            />
          ) : (
            <TeamBadge abbrev={team.abbrev} color={team.color} size={52} />
          )}
          <div>
            <p className="label">{team.abbrev}</p>
            <h2 className="text-[36px] font-semibold leading-[1.05] tracking-[-0.025em]">
              {team.name}
            </h2>
          </div>
        </div>
        {row ? (
          <div className="flex flex-wrap gap-2">
            <span className="chip">
              <span className="num">
                {row.w}&#8211;{row.l}
                {row.t > 0 ? `\u2013${row.t}` : ""}
              </span>
            </span>
            <span className="chip">
              Seed <span className="num ml-1">{rank}</span>
            </span>
            <span className="chip">
              <span className="num">
                {row.diff > 0 ? "+" : ""}
                {row.diff}
              </span>
              <span className="ml-1">diff</span>
            </span>
          </div>
        ) : null}
      </section>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Wins" value={row?.w ?? 0} />
        <StatTile label="Losses" value={row?.l ?? 0} />
        <StatTile label="Points for" value={row?.pf ?? 0} />
        <StatTile label="Points against" value={row?.pa ?? 0} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel eyebrow="Who plays" title="Roster">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-faint">
                <th className="py-1.5 font-medium">Player</th>
                <th className="tabular py-1.5 text-right font-medium">GP</th>
                <th className="tabular py-1.5 text-right font-medium">PPG</th>
                <th className="tabular py-1.5 text-right font-medium">RPG</th>
                <th className="tabular py-1.5 text-right font-medium">APG</th>
              </tr>
            </thead>
            <tbody>
              {team.roster.map((m) => {
                const lines = byPlayer.get(m.user_id) ?? [];
                const totals = aggregateLines(lines);
                return (
                  <tr key={m.id} className="border-t border-rule">
                    <td className="py-2.5">
                      <Link
                        href={`/league/${slug}/player/${m.user_id}`}
                        className="flex items-center gap-2.5 font-semibold hover:underline"
                      >
                        <Avatar name={m.full_name} src={m.avatar_url} size={28} />
                        <span className="truncate">
                          {m.full_name}
                          {m.is_captain ? (
                            <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-on-accent">
                              C
                            </span>
                          ) : null}
                        </span>
                        {m.position ? (
                          <span className="num text-xs text-ink-faint">
                            {m.position}
                          </span>
                        ) : null}
                        {jerseys && m.jersey_number != null ? (
                          <span className="tabular text-xs text-ink-faint">
                            #{m.jersey_number}
                          </span>
                        ) : null}
                        {m.lineup_role === "starter" ? (
                          <span
                            aria-label="Starter"
                            title="Starter"
                            className="size-1.5 shrink-0 rounded-full bg-accent"
                          />
                        ) : null}
                      </Link>
                    </td>
                    <td className="tabular py-2.5 text-right">{totals.games}</td>
                    <td className="tabular py-2.5 text-right">
                      {perGame(totals.pts, totals.games).toFixed(1)}
                    </td>
                    <td className="tabular py-2.5 text-right">
                      {perGame(totals.reb, totals.games).toFixed(1)}
                    </td>
                    <td className="tabular py-2.5 text-right">
                      {perGame(totals.ast, totals.games).toFixed(1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>

        <Panel eyebrow="Season" title="Results">
          {teamGames.length === 0 ? (
            <p className="text-sm text-ink-faint">No games yet.</p>
          ) : (
            <div className="space-y-3">
              {teamGames.map((g) => (
                <GameCard key={g.id} game={g} slug={slug} />
              ))}
            </div>
          )}
        </Panel>
      </div>

      {canManage ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <TeamCardEditor slug={slug} leagueId={league.id} team={team} />
          <LineupEditor
            slug={slug}
            sport={league.sport}
            teamId={team.id}
            roster={team.roster}
            jerseys={jerseys}
          />
        </div>
      ) : null}
    </div>
  );
}
