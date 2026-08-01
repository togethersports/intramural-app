import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { LiveConsole } from "@/components/live-console";
import { requireUser } from "@/lib/auth";
import {
  getGame,
  getGameEvents,
  getLeague,
  getLineups,
  getSeason,
  getTeamsWithRosters,
} from "@/lib/data";
import { parseGameRules } from "@core/game-rules";
import { isLeagueAdmin } from "@core/league-constants";

export const metadata: Metadata = { title: "Live console" };

export default async function LiveConsolePage({
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

  const canScore = isLeagueAdmin(league.role) || game.scorekeeper_id === user.id;
  if (!canScore || game.status === "final" || game.status === "forfeit") {
    redirect(`/league/${slug}/game/${gameId}`);
  }

  const [teams, events, lineups, season] = await Promise.all([
    getTeamsWithRosters(game.season_id),
    getGameEvents(gameId),
    getLineups(gameId),
    getSeason(game.season_id),
  ]);
  const homeTeam = teams.find((t) => t.id === game.home_team_id);
  const awayTeam = teams.find((t) => t.id === game.away_team_id);
  if (!homeTeam || !awayTeam) notFound();

  const side = (t: typeof homeTeam) => ({
    id: t.id,
    name: t.name,
    abbrev: t.abbrev,
    color: t.color,
    roster: t.roster,
  });

  return (
    <LiveConsole
      slug={slug}
      game={game}
      home={side(homeTeam)}
      away={side(awayTeam)}
      rules={parseGameRules(season?.rules)}
      serverEvents={events.map((e) => ({
        id: e.id,
        seq: e.seq,
        period: e.period,
        clock_ms: e.clock_ms,
        team_id: e.team_id,
        user_id: e.user_id,
        type: e.type,
        value: e.value,
        related_user_id: e.related_user_id,
        client_uuid: e.client_uuid,
        voided: e.voided,
      }))}
      lineups={lineups}
    />
  );
}
