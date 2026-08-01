import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { LiveConsole, type TeamSide } from "@/components/live-console";
import { requireUser } from "@/lib/auth";
import {
  getGame,
  getGameEvents,
  getGameGuests,
  getLeague,
  getLineups,
  getSeason,
  getTeamById,
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
  if (
    !canScore ||
    game.status === "final" ||
    game.status === "forfeit" ||
    game.status === "abandoned"
  ) {
    redirect(`/league/${slug}/game/${gameId}`);
  }

  const [teams, events, lineups, season, guests] = await Promise.all([
    getTeamsWithRosters(game.season_id),
    getGameEvents(gameId),
    getLineups(gameId),
    getSeason(game.season_id),
    getGameGuests(gameId),
  ]);

  // An external (free-text) opponent isn't in the league team list — fetch
  // it directly; its roster is guests-only.
  const sideFor = async (teamId: string): Promise<TeamSide | null> => {
    const known = teams.find((t) => t.id === teamId);
    if (known) {
      return {
        id: known.id,
        name: known.name,
        abbrev: known.abbrev,
        color: known.color,
        roster: known.roster,
      };
    }
    const external = await getTeamById(teamId);
    if (!external) return null;
    return {
      id: external.id,
      name: external.name,
      abbrev: external.abbrev,
      color: external.color,
      roster: [],
    };
  };
  const homeTeam = await sideFor(game.home_team_id);
  const awayTeam = await sideFor(game.away_team_id);
  if (!homeTeam || !awayTeam) notFound();

  return (
    <LiveConsole
      slug={slug}
      game={game}
      home={homeTeam}
      away={awayTeam}
      // per-game overrides (ad-hoc settings, mid-game edits) win over the
      // season's rules
      rules={parseGameRules({ ...(season?.rules ?? {}), ...game.rules_override })}
      serverGuests={guests}
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
