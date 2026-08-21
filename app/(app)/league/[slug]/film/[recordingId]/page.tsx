import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getDetectedEvents,
  getFilmUrl,
  getGame,
  getGameGuests,
  getLeague,
  getLeagueReviewedShots,
  getMissingConsents,
  getRecording,
  getTeamById,
  getTeamsWithRosters,
  getVisionJob,
} from "@/lib/data";
import { shotModelFromRows } from "@core/vision";
import { ReviewRoom, type ReviewSide } from "./review-room";

export const metadata: Metadata = { title: "Review film" };

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ slug: string; recordingId: string }>;
}) {
  const { slug, recordingId } = await params;
  const league = await getLeague(slug);
  if (!league) notFound();
  if (league.role !== "commissioner") redirect(`/league/${slug}`);

  const recording = await getRecording(recordingId);
  if (!recording) notFound();
  const game = await getGame(recording.game_id);
  if (!game) notFound();

  const [events, teams, guests, job, filmUrl, missing, reviewedShots] =
    await Promise.all([
      getDetectedEvents(recordingId),
      getTeamsWithRosters(game.season_id),
      getGameGuests(game.id),
      getVisionJob(recordingId),
      getFilmUrl(recording.storage_path),
      getMissingConsents(recordingId),
      getLeagueReviewedShots(league.id),
    ]);

  // The self-teaching loop: every ruling an admin has ever made re-trains
  // the scanner's models before the next scan runs. Weights are never
  // stored — refit from the full history each visit, nothing goes stale.
  const model = shotModelFromRows(reviewedShots);

  // An ad-hoc game's external opponent isn't in the season team list; its
  // roster is guests only. Same shape as the live console.
  const sideFor = async (teamId: string): Promise<ReviewSide | null> => {
    const known = teams.find((t) => t.id === teamId);
    const guestRoster = guests
      .filter((g) => g.team_id === teamId)
      .map((g) => ({
        id: g.id,
        playerId: g.id,
        name: g.display_name,
        isGuest: true,
        jersey: null as number | null,
      }));
    if (known) {
      return {
        id: known.id,
        name: known.name,
        abbrev: known.abbrev,
        color: known.color,
        roster: [
          ...known.roster.map((r) => ({
            id: r.id,
            playerId: r.user_id,
            name: r.full_name,
            isGuest: false,
            jersey: r.jersey_number,
          })),
          ...guestRoster,
        ],
      };
    }
    const external = await getTeamById(teamId);
    if (!external) return null;
    return {
      id: external.id,
      name: external.name,
      abbrev: external.abbrev,
      color: external.color,
      roster: guestRoster,
    };
  };
  const home = await sideFor(game.home_team_id);
  const away = await sideFor(game.away_team_id);
  if (!home || !away) notFound();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {home.name} v {away.name}
        </h1>
        <div className="flex gap-2 text-[15px] font-medium text-ink-muted">
          <Link href={`/league/${slug}/film`} className="underline">
            All film
          </Link>
          <span aria-hidden>·</span>
          <Link href={`/league/${slug}/game/${game.id}`} className="underline">
            Box score
          </Link>
        </div>
      </div>

      <ReviewRoom
        slug={slug}
        recording={recording}
        gameId={game.id}
        home={home}
        away={away}
        filmUrl={filmUrl}
        serverEvents={events}
        job={job}
        missingConsents={missing}
        model={model}
      />
    </div>
  );
}
