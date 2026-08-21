import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EmptyState, TeamBadge } from "@/components/ui";
import {
  getGames,
  getLeague,
  getLeagueRecordings,
  getSeasons,
  getTeams,
} from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { FilmUploader } from "./film-uploader";
import { RecordingRow } from "./recording-row";

export const metadata: Metadata = { title: "Film" };

export default async function FilmPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeague(slug);
  if (!league) notFound();
  // Film is the commissioner's room — RLS already limits it to league
  // admins, and this narrows it to the one person who runs the league.
  if (league.role !== "commissioner") redirect(`/league/${slug}`);

  const [recordings, seasons] = await Promise.all([
    getLeagueRecordings(league.id),
    getSeasons(league.id),
  ]);

  // Retention is opportunistic (no pg_cron on the free tier) — the film page
  // is the natural place to sweep, the same way the dashboard sweeps leagues.
  const supabase = await createClient();
  await supabase.rpc("purge_expired_recordings");

  const season = seasons[0];
  const [games, teams] = season
    ? await Promise.all([getGames(season.id), getTeams(season.id)])
    : [[], []];
  const teamById = new Map(teams.map((t) => [t.id, t]));

  // Only games that have actually been played can carry film worth reviewing.
  const filmable = games
    .filter((g) => g.status !== "postponed")
    .sort((a, b) => (b.scheduled_date ?? "").localeCompare(a.scheduled_date ?? ""));

  return (
    <div className="space-y-5">
      {/* The shell carries the screen title; this line carries the count. */}
      <p className="label text-ink-muted">
        <span className="num">{recordings.length}</span> recording
        {recordings.length === 1 ? "" : "s"}
      </p>

      <section className="card p-5 sm:p-6">
        <h2 className="mb-1 text-lg font-semibold tracking-tight">
          How this works
        </h2>
        <p className="max-w-[62ch] text-[17px] leading-[1.55] text-ink-body">
          The model watches the rim and proposes shots with a timestamp and a
          confidence. You confirm, edit, or reject each one in the review room,
          shakiest call first. Nothing reaches a box score without your
          keystroke. It cannot see fouls, violations, or and-ones — add those by
          hand while you review.
        </p>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="mb-1 text-lg font-semibold tracking-tight">Upload film</h2>
        <p className="mb-4 max-w-[62ch] text-sm text-ink-muted">
          One fixed camera, sideline at half court, 1080p60, the rim fully in
          frame. Bad footage is the one thing the model cannot recover from.
        </p>
        {filmable.length === 0 ? (
          <EmptyState
            title="No games to attach film to"
            body="Schedule or create a game first — film hangs off a game so its events land in that box score."
            action={
              <Link
                href={`/league/${slug}/game/new`}
                className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-on-ink hover:opacity-90"
              >
                New game
              </Link>
            }
          />
        ) : (
          <FilmUploader
            slug={slug}
            leagueId={league.id}
            games={filmable.map((g) => ({
              id: g.id,
              label: [
                `Week ${g.week}`,
                teamById.get(g.home_team_id)?.abbrev ?? "?",
                "vs",
                teamById.get(g.away_team_id)?.abbrev ?? "?",
                g.scheduled_date ?? "",
              ]
                .filter(Boolean)
                .join(" "),
            }))}
          />
        )}
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Recordings</h2>
        {recordings.length === 0 ? (
          <p className="text-sm text-ink-faint">
            Nothing uploaded yet. Film a game, drop the file above.
          </p>
        ) : (
          <ul className="space-y-2">
            {recordings.map((r) => {
              const home = r.game ? teamById.get(r.game.home_team_id) : undefined;
              const away = r.game ? teamById.get(r.game.away_team_id) : undefined;
              return (
                <RecordingRow
                  key={r.id}
                  slug={slug}
                  recording={r}
                  matchup={
                    home && away ? (
                      <span className="flex items-center gap-1.5">
                        <TeamBadge abbrev={home.abbrev} color={home.color} size={22} />
                        <span className="text-ink-faint">v</span>
                        <TeamBadge abbrev={away.abbrev} color={away.color} size={22} />
                      </span>
                    ) : null
                  }
                />
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
