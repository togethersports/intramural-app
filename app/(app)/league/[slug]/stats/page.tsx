import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconChart } from "@/components/icons";
import { Avatar, EmptyState, Meter } from "@/components/ui";
import {
  getActiveSeason,
  getLeague,
  getSeasonPlayerStats,
  getTeams,
} from "@/lib/data";
import {
  aggregateLines,
  formatPct,
  pct,
  perGame,
  type SeasonTotals,
} from "@/packages/core/stats";

export const metadata: Metadata = { title: "Stats" };

interface PlayerSeason {
  userId: string;
  name: string;
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

  const byPlayer = new Map<string, { name: string; teamId: string; lines: typeof rows }>();
  for (const r of rows) {
    if (!byPlayer.has(r.user_id))
      byPlayer.set(r.user_id, { name: r.full_name ?? "Unnamed", teamId: r.team_id, lines: [] });
    byPlayer.get(r.user_id)!.lines.push(r);
  }
  const players: PlayerSeason[] = [...byPlayer.entries()].map(
    ([userId, { name, teamId, lines }]) => ({
      userId,
      name,
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
            <section key={cat.key} className="card p-5">
              <h3 className="mb-3 font-semibold tracking-tight">{cat.label}</h3>
              <ol className="space-y-2.5">
                {top.map((p) => (
                  <li key={p.userId}>
                    <Link
                      href={`/league/${slug}/player/${p.userId}`}
                      className="flex items-center gap-2.5 hover:underline"
                    >
                      <Avatar name={p.name} size={26} />
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
            </section>
          );
        })}
      </div>

      <section className="card p-5 sm:p-6">
        <h3 className="mb-3 text-lg font-semibold tracking-tight">
          All players — season totals
        </h3>
        <div className="scroll-x">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-faint">
                <th className="py-1.5 pr-2 font-medium">Player</th>
                <th className="py-1.5 pr-2 font-medium">Team</th>
                {["GP", "PTS", "REB", "AST", "STL", "BLK", "TO", "FG%", "3P%", "FT%", "+/−"].map((h) => (
                  <th key={h} className="tabular px-2 py-1.5 text-right font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...players]
                .sort((a, b) => b.totals.pts - a.totals.pts)
                .map((p) => (
                  <tr key={p.userId} className="border-t border-rule">
                    <td className="sticky left-0 z-10 max-w-[9rem] truncate bg-surface py-2.5 pr-3">
                      <Link
                        href={`/league/${slug}/player/${p.userId}`}
                        className="font-semibold hover:underline"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-2">
                      <span className="flex max-w-[7rem] items-center gap-1.5 truncate text-xs font-medium text-ink-body">
                        <span
                          aria-hidden
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: p.teamColor }}
                        />
                        {p.teamName}
                      </span>
                    </td>
                    <td className="tabular px-2 py-2.5 text-right">{p.totals.games}</td>
                    <td className="tabular px-2 py-2.5 text-right font-semibold">{p.totals.pts}</td>
                    <td className="tabular px-2 py-2.5 text-right">{p.totals.reb}</td>
                    <td className="tabular px-2 py-2.5 text-right">{p.totals.ast}</td>
                    <td className="tabular px-2 py-2.5 text-right">{p.totals.stl}</td>
                    <td className="tabular px-2 py-2.5 text-right">{p.totals.blk}</td>
                    <td className="tabular px-2 py-2.5 text-right">{p.totals.tov}</td>
                    <td className="tabular px-2 py-2.5 text-right">{formatPct(pct(p.totals.fgm, p.totals.fga))}</td>
                    <td className="tabular px-2 py-2.5 text-right">{formatPct(pct(p.totals.tpm, p.totals.tpa))}</td>
                    <td className="tabular px-2 py-2.5 text-right">{formatPct(pct(p.totals.ftm, p.totals.fta))}</td>
                    <td className="tabular px-2 py-2.5 text-right">
                      {p.totals.plus_minus > 0 ? `+${p.totals.plus_minus}` : p.totals.plus_minus}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
