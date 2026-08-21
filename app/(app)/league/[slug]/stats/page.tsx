import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconChart } from "@/components/icons";
import { Avatar, EmptyState, Meter, Panel } from "@/components/ui";
import {
  getActiveSeason,
  getLeague,
  getSeasonPlayerStats,
  getTeams,
} from "@/lib/data";
import {
  aggregateLines,
  pct,
  perGame,
  type SeasonTotals,
} from "@core/stats";
import { SeasonTable } from "./season-table";

export const metadata: Metadata = { title: "Stats" };

interface PlayerSeason {
  userId: string;
  name: string;
  avatarUrl: string | null;
  teamName: string;
  teamColor: string;
  totals: SeasonTotals;
}

export default async function StatsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeague(slug);
  if (!league) notFound();
  const season = await getActiveSeason(league.id);
  if (!season) {
    return (
      <div className="card p-6">
        <EmptyState icon={<IconChart size={26} />} title="No season yet" />
      </div>
    );
  }

  const [rows, teams] = await Promise.all([
    getSeasonPlayerStats(season.id),
    getTeams(season.id),
  ]);
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const byPlayer = new Map<
    string,
    { name: string; avatarUrl: string | null; teamId: string; lines: typeof rows }
  >();
  for (const r of rows) {
    if (!byPlayer.has(r.user_id))
      byPlayer.set(r.user_id, {
        name: r.full_name ?? "Unnamed",
        avatarUrl: r.avatar_url ?? null,
        teamId: r.team_id,
        lines: [],
      });
    byPlayer.get(r.user_id)!.lines.push(r);
  }
  const players: PlayerSeason[] = [...byPlayer.entries()].map(
    ([userId, { name, avatarUrl, teamId, lines }]) => ({
      userId,
      name,
      avatarUrl,
      teamName: teamById.get(teamId)?.name ?? "—",
      teamColor: teamById.get(teamId)?.color ?? "#54749b",
      totals: aggregateLines(lines),
    }),
  );

  if (players.length === 0) {
    return (
      <div className="card p-6">
        <EmptyState
          icon={<IconChart size={26} />}
          title="No stats yet"
          body="Leaderboards fill in after the first tracked game goes final."
        />
      </div>
    );
  }

  const categories: {
    key: string;
    label: string;
    value: (p: PlayerSeason) => number;
    fmt: (v: number) => string;
  }[] = [
    { key: "ppg", label: "Points", value: (p) => perGame(p.totals.pts, p.totals.games), fmt: (v) => v.toFixed(1) },
    { key: "rpg", label: "Rebounds", value: (p) => perGame(p.totals.reb, p.totals.games), fmt: (v) => v.toFixed(1) },
    { key: "apg", label: "Assists", value: (p) => perGame(p.totals.ast, p.totals.games), fmt: (v) => v.toFixed(1) },
    { key: "spg", label: "Steals", value: (p) => perGame(p.totals.stl, p.totals.games), fmt: (v) => v.toFixed(1) },
    { key: "bpg", label: "Blocks", value: (p) => perGame(p.totals.blk, p.totals.games), fmt: (v) => v.toFixed(1) },
    { key: "fg", label: "FG% (min 5 FGA)", value: (p) => (p.totals.fga >= 5 ? (pct(p.totals.fgm, p.totals.fga) ?? 0) : -1), fmt: (v) => `${(v * 100).toFixed(1)}%` },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => {
          const top = [...players]
            .filter((p) => cat.value(p) >= 0)
            .sort((a, b) => cat.value(b) - cat.value(a))
            .slice(0, 5);
          const max = top.length > 0 ? cat.value(top[0]) : 0;
          return (
            <Panel key={cat.key} eyebrow="Leaders" title={cat.label}>
              <ol className="space-y-2.5">
                {top.map((p) => (
                  <li key={p.userId}>
                    <Link
                      href={`/league/${slug}/player/${p.userId}`}
                      className="flex items-center gap-2.5 hover:underline"
                    >
                      <Avatar name={p.name} src={p.avatarUrl} size={26} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold leading-tight">
                          {p.name}
                        </span>
                        <Meter
                          value={max > 0 ? cat.value(p) : 0}
                          max={max || 1}
                          className="mt-1 h-1.5"
                        />
                      </span>
                      <span className="num text-lg">
                        {cat.fmt(cat.value(p))}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </Panel>
          );
        })}
      </div>

      <Panel title="Season totals" flush>
        <SeasonTable
          slug={slug}
          rows={players.map((p) => ({
            userId: p.userId,
            name: p.name,
            teamName: p.teamName,
            teamColor: p.teamColor,
            totals: p.totals,
          }))}
        />
      </Panel>
    </div>
  );
}
