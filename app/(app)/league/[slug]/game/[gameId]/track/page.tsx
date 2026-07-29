import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  getGame,
  getGameEvents,
  getLeague,
  getLineups,
  getTeamsWithRosters,
} from "@/lib/data";
import { isLeagueAdmin } from "@/packages/core/league-constants";
import { Tracker } from "./tracker";

export const metadata: Metadata = { title: "Live tracker" };

export default async function TrackPage({
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

  const canTrack = isLeagueAdmin(league.role) || game.scorekeeper_id === user.id;
  if (!canTrack || game.status === "final" || game.status === "forfeit") {
    redirect(`/league/${slug}/game/${gameId}`);
  }

  const [teams, events, lineups] = await Promise.all([
    getTeamsWithRosters(game.season_id),
    getGameEvents(gameId),
    getLineups(gameId),
  ]);
  const homeTeam = teams.find((t) => t.id === game.home_team_id);
  const awayTeam = teams.find((t) => t.id === game.away_team_id);
  if (!homeTeam || !awayTeam) notFound();

  return (
    <Tracker
      slug={slug}
      game={game}
      home={{
        id: homeTeam.id,
        name: homeTeam.name,
        color: homeTeam.color,
        roster: homeTeam.roster,
      }}
      away={{
        id: awayTeam.id,
        name: awayTeam.name,
        color: awayTeam.color,
        roster: awayTeam.roster,
      }}
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
