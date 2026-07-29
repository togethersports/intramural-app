import Link from "next/link";
import { notFound } from "next/navigation";
import { TeamBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import {
  getGame,
  getGameEvents,
  getLeague,
  getLineups,
  getTeamsWithRosters,
} from "@/lib/data";
import { isLeagueAdmin } from "@/lib/league-constants";
import { EVENT_LABELS } from "@/lib/game-constants";
import { computeBoxScore, type StatLine } from "@/lib/stats";
import { createClient } from "@/lib/supabase/server";
import type { PlayerGameStatRow } from "@/lib/types";
import { LiveRefresher } from "./live-refresher";

function BoxTable({
  title,
  abbrev,
  color,
  rows,
}: {
  title: string;
  abbrev: string;
  color: string;
  rows: (StatLine & { name: string; userId: string; href: string })[];
}) {
  return (
    <section className="card overflow-hidden">
      <h3 className="flex items-center gap-2.5 border-b border-rule px-5 py-4 text-[19px] font-semibold tracking-tight">
        <TeamBadge abbrev={abbrev} color={color} size={28} />
        {title}
      </h3>
      <div className="scroll-x p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-faint">
              <th className="py-1 pr-2 font-medium">Player</th>
              {["PTS", "REB", "AST", "STL", "BLK", "TO", "PF", "FG", "3P", "FT", "+/−"].map((h) => (
                <th key={h} className="tabular px-1.5 py-1 text-right font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows
              .sort((a, b) => b.pts - a.pts)
              .map((r) => (
                <tr key={r.userId} className="border-t border-rule">
                  <td className="sticky left-0 z-10 max-w-[8rem] truncate bg-surface py-2 pr-3">
                    <Link href={r.href} className="font-semibold hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="tabular px-1.5 py-2 text-right font-semibold">{r.pts}</td>
                  <td className="tabular px-1.5 py-2 text-right">{r.reb}</td>
                  <td className="tabular px-1.5 py-2 text-right">{r.ast}</td>
                  <td className="tabular px-1.5 py-2 text-right">{r.stl}</td>
                  <td className="tabular px-1.5 py-2 text-right">{r.blk}</td>
                  <td className="tabular px-1.5 py-2 text-right">{r.tov}</td>
                  <td className="tabular px-1.5 py-2 text-right">{r.pf}</td>
                  <td className="tabular px-1.5 py-2 text-right">{r.fgm}/{r.fga}</td>
                  <td className="tabular px-1.5 py-2 text-right">{r.tpm}/{r.tpa}</td>
                  <td className="tabular px-1.5 py-2 text-right">{r.ftm}/{r.fta}</td>
                  <td className="tabular px-1.5 py-2 text-right">
                    {r.plus_minus > 0 ? `+${r.plus_minus}` : r.plus_minus}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function GamePage({
  params,
}: {
  params: Promise<{ slug: string; gameId: string }>;
}) {
  const { slug, gameId } = await params;
  const user = await requireUser();
  const league = await getLeague(slug);
  if (!league) notFound();
  const game = await getGame(gameId);
  if (!game) notFound();

  const [events, lineups, teams] = await Promise.all([
    getGameEvents(gameId),
    getLineups(gameId),
    getTeamsWithRosters(game.season_id),
  ]);

  const nameOf = new Map<string, string>();
  for (const t of teams)
    for (const r of t.roster) nameOf.set(r.user_id, r.full_name);

  // Final games read from materialized stats; live games compute from events.
  let lines: (StatLine & { userId: string; teamId: string })[] = [];
  let homeScore = game.home_score;
  let awayScore = game.away_score;
  if (game.status === "final" || game.status === "forfeit") {
    const supabase = await createClient();
    const { data } = await supabase
      .from("player_game_stats")
      .select("*")
      .eq("game_id", gameId);
    lines = ((data as unknown as PlayerGameStatRow[]) ?? []).map((r) => ({
      ...r,
      userId: r.user_id,
      teamId: r.team_id,
    }));
  } else {
    const box = computeBoxScore(events, lineups, game.home_team_id, game.away_team_id);
    lines = [...box.players.entries()].map(([userId, l]) => ({
      ...l,
      userId,
      teamId: l.team_id,
    }));
    if (game.status === "live") {
      homeScore = box.homeScore;
      awayScore = box.awayScore;
    }
  }

  const toRows = (teamId: string) =>
    lines
      .filter((l) => l.teamId === teamId)
      .map((l) => ({
        ...l,
        name: nameOf.get(l.userId) ?? "Unnamed",
        href: `/league/${slug}/player/${l.userId}`,
      }));

  const canTrack =
    (isLeagueAdmin(league.role) || game.scorekeeper_id === user.id) &&
    game.status !== "final" &&
    game.status !== "forfeit";

  const visibleEvents = [...events].filter((e) => !e.voided).reverse();

  return (
    <div className="space-y-5">
      <LiveRefresher gameId={gameId} live={game.status === "live"} />

      {/* Score header */}
      <section className="card p-6">
        <div className="mb-2 flex items-center justify-between text-xs font-medium text-ink-body">
          <span>
            Week {game.week}
            {game.time_slot?.label ? ` · ${game.time_slot.label}` : ""}
            {game.venue?.name ? ` · ${game.venue.name}` : ""}
          </span>
          {game.status === "live" ? (
            <span className="inline-flex items-center gap-1.5 font-bold text-accent">
              <span className="relative flex size-2">
                <span className="absolute h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative size-2 rounded-full bg-accent" />
              </span>
              LIVE · P{game.period}
            </span>
          ) : (
            <span className="font-bold uppercase">{game.status}</span>
          )}
        </div>
        <div className="flex items-center justify-center gap-6 sm:gap-10">
          {[
            { team: game.home_team, score: homeScore, id: game.home_team_id },
            { team: game.away_team, score: awayScore, id: game.away_team_id },
          ].map((side, i) => (
            <div key={side.id} className={`flex items-center gap-4 ${i === 1 ? "flex-row-reverse" : ""}`}>
              <Link
                href={`/league/${slug}/team/${side.id}`}
                className="flex items-center gap-2.5 hover:underline"
              >
                <span
                  aria-hidden
                  className="grid size-11 place-items-center rounded-[12px] text-xs font-bold text-white"
                  style={{ backgroundColor: side.team?.color ?? "#54749b" }}
                >
                  {side.team?.abbrev ?? "?"}
                </span>
                <span className="hidden text-lg font-semibold tracking-tight sm:block">
                  {side.team?.name ?? "?"}
                </span>
              </Link>
              <span className="num text-5xl">{side.score}</span>
              {i === 0 ? <span className="text-ink-faint">—</span> : null}
            </div>
          ))}
        </div>
        {canTrack ? (
          <div className="mt-4 text-center">
            <Link
              href={`/league/${slug}/game/${gameId}/track`}
              className="inline-flex min-h-11 items-center justify-center rounded-control bg-ink px-6 text-sm font-semibold text-surface hover:bg-black"
            >
              {game.status === "live" ? "Resume tracking" : "Open tracker"}
            </Link>
          </div>
        ) : null}
      </section>

      {lines.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <BoxTable
            title={game.home_team?.name ?? "Home"}
            abbrev={game.home_team?.abbrev ?? "?"}
            color={game.home_team?.color ?? "#4E7CA8"}
            rows={toRows(game.home_team_id)}
          />
          <BoxTable
            title={game.away_team?.name ?? "Away"}
            abbrev={game.away_team?.abbrev ?? "?"}
            color={game.away_team?.color ?? "#4E7CA8"}
            rows={toRows(game.away_team_id)}
          />
        </div>
      ) : null}

      {/* Play-by-play */}
      <section className="card p-5 sm:p-6">
        <h3 className="mb-3 text-lg font-semibold tracking-tight">
          Play-by-play
        </h3>
        {visibleEvents.length === 0 ? (
          <p className="text-sm text-ink-faint">
            Nothing yet — events stream in live once tracking starts.
          </p>
        ) : (
          <ul className="space-y-1">
            {visibleEvents.slice(0, 60).map((e) => (
              <li
                key={e.id}
                className="flex items-baseline gap-3 rounded-panel px-2 py-1.5 text-sm odd:bg-paper"
              >
                <span className="tabular w-8 shrink-0 text-xs text-ink-faint">
                  P{e.period}
                </span>
                <span
                  aria-hidden
                  className="mt-1 size-2 shrink-0 self-center rounded-full"
                  style={{
                    backgroundColor:
                      e.team_id === game.home_team_id
                        ? (game.home_team?.color ?? "#54749b")
                        : e.team_id === game.away_team_id
                          ? (game.away_team?.color ?? "#54749b")
                          : "#8b959d",
                  }}
                />
                <span className="min-w-0">
                  <span className="font-semibold">
                    {e.user_id ? (nameOf.get(e.user_id) ?? "—") : ""}
                  </span>{" "}
                  {EVENT_LABELS[e.type] ?? e.type}
                  {e.type === "sub" && e.related_user_id
                    ? ` (in for ${nameOf.get(e.related_user_id) ?? "—"})`
                    : ""}
                  {e.type === "ast" && e.related_user_id
                    ? ` → ${nameOf.get(e.related_user_id) ?? "—"}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
