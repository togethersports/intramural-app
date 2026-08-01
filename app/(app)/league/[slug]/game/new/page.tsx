import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getActiveSeason, getLeague, getTeams, getVenues } from "@/lib/data";
import { isLeagueAdmin } from "@core/league-constants";
import { parseGameRules } from "@core/game-rules";
import { NewGameForm } from "./new-game-form";

export const metadata: Metadata = { title: "New game" };

export default async function NewGamePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireUser();
  const league = await getLeague(slug);
  if (!league) notFound();
  if (!isLeagueAdmin(league.role)) redirect(`/league/${slug}`);
  const season = await getActiveSeason(league.id);
  if (!season) redirect(`/league/${slug}/console`);

  const [teams, venues] = await Promise.all([
    getTeams(season.id),
    getVenues(league.id),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="New game"
        subtitle="Any matchup, playable right now — no schedule required."
      />
      <div className="card max-w-2xl p-6 sm:p-8">
        <NewGameForm
          slug={slug}
          seasonId={season.id}
          teams={teams.map((t) => ({ id: t.id, name: t.name }))}
          venues={venues.map((v) => ({ id: v.id, name: v.name }))}
          defaults={parseGameRules(season.rules)}
        />
      </div>
    </div>
  );
}
