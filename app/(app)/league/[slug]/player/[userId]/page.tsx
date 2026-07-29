import { notFound } from "next/navigation";
import { Avatar, StatTile } from "@/components/ui";
import {
  getActiveSeason,
  getLeague,
  getPlayerGameLog,
  getTeamsWithRosters,
} from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { aggregateLines, formatPct, pct, perGame, tsPct } from "@core/stats";

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ slug: string; userId: string }>;
}) {
  const { slug, userId } = await params;
  const league = await getLeague(slug);
  if (!league) notFound();
  const season = await getActiveSeason(league.id);

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, grade, positions")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) notFound();

  const log = season ? await getPlayerGameLog(season.id, userId) : [];
  const totals = aggregateLines(log);
  const teams = season ? await getTeamsWithRosters(season.id) : [];
  const myTeam = teams.find((t) => t.roster.some((r) => r.user_id === userId));

  return (
    <div className="space-y-5">
      <section className="card flex flex-wrap items-center gap-4 p-6">
        <Avatar name={profile.full_name || "?"} size={64} />
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-semibold tracking-tight">
            {profile.full_name || "Unnamed player"}
          </h2>
          <p className="text-sm text-ink-body">
            {myTeam ? myTeam.name : "Free agent"}
            {profile.grade ? ` · Grade ${profile.grade}` : ""}
          </p>
        </div>
        {totals.games > 0 ? (
          <div className="flex gap-4 text-center">
            {[
              [perGame(totals.pts, totals.games).toFixed(1), "PPG"],
              [perGame(totals.reb, totals.games).toFixed(1), "RPG"],
              [perGame(totals.ast, totals.games).toFixed(1), "APG"],
            ].map(([v, label]) => (
              <div key={label}>
                <p className="num text-3xl">{v}</p>
                <p className="text-xs font-medium text-ink-faint">{label}</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {totals.games > 0 ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Games" value={totals.games} />
          <StatTile label="FG%" value={formatPct(pct(totals.fgm, totals.fga))} />
          <StatTile label="TS%" value={formatPct(tsPct(totals.pts, totals.fga, totals.fta))} />
          <StatTile
            label="+/−"
            value={totals.plus_minus > 0 ? `+${totals.plus_minus}` : totals.plus_minus}
          />
        </div>
      ) : null}

      <section className="card p-5 sm:p-6">
        <h3 className="mb-3 text-lg font-semibold tracking-tight">Game log</h3>
        {log.length === 0 ? (
          <p className="text-sm text-ink-faint">
            No games recorded{season ? "" : " — no active season"}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-faint">
                  <th className="py-1.5 pr-2 font-medium">Game</th>
                  {["PTS", "REB", "AST", "STL", "BLK", "TO", "PF", "FG", "3P", "FT", "+/−"].map(
                    (h) => (
                      <th key={h} className="tabular px-2 py-1.5 text-right font-medium">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {log.map((r) => {
                  const opponentIsHome = r.game.away_team_id === r.team_id;
                  const opponent = opponentIsHome
                    ? r.game.home_team?.name
                    : r.game.away_team?.name;
                  return (
                    <tr key={r.game_id} className="border-t border-rule">
                      <td className="py-2.5 pr-2 font-medium">
                        Wk {r.game.week} · {opponentIsHome ? "@" : "vs"}{" "}
                        {opponent ?? "?"}
                      </td>
                      <td className="tabular px-2 py-2.5 text-right font-semibold">{r.pts}</td>
                      <td className="tabular px-2 py-2.5 text-right">{r.reb}</td>
                      <td className="tabular px-2 py-2.5 text-right">{r.ast}</td>
                      <td className="tabular px-2 py-2.5 text-right">{r.stl}</td>
                      <td className="tabular px-2 py-2.5 text-right">{r.blk}</td>
                      <td className="tabular px-2 py-2.5 text-right">{r.tov}</td>
                      <td className="tabular px-2 py-2.5 text-right">{r.pf}</td>
                      <td className="tabular px-2 py-2.5 text-right">
                        {r.fgm}/{r.fga}
                      </td>
                      <td className="tabular px-2 py-2.5 text-right">
                        {r.tpm}/{r.tpa}
                      </td>
                      <td className="tabular px-2 py-2.5 text-right">
                        {r.ftm}/{r.fta}
                      </td>
                      <td className="tabular px-2 py-2.5 text-right">
                        {r.plus_minus > 0 ? `+${r.plus_minus}` : r.plus_minus}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
