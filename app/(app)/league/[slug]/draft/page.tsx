import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconWhistle } from "@/components/icons";
import { EmptyState } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import {
  getActiveSeason,
  getDraft,
  getDraftPicks,
  getDraftQueue,
  getFreeAgents,
  getLeague,
  getTeamsWithRosters,
} from "@/lib/data";
import { isLeagueAdmin } from "@/lib/league-constants";
import { DraftRoom } from "./draft-room";
import { DraftSetupForm } from "./draft-setup";

export const metadata: Metadata = { title: "Draft" };

export default async function DraftPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();
  const league = await getLeague(slug);
  if (!league) notFound();
  const admin = isLeagueAdmin(league.role);
  const season = await getActiveSeason(league.id);

  if (!season) {
    return (
      <div className="card p-6">
        <EmptyState
          icon={<IconWhistle size={26} />}
          title="No season yet"
          body="Create a season and teams before drafting."
        />
      </div>
    );
  }

  const [draft, teams, eligible] = await Promise.all([
    getDraft(season.id),
    getTeamsWithRosters(season.id),
    getFreeAgents(league.id, season.id),
  ]);

  if (!draft) {
    return (
      <div className="card p-6">
        {admin ? (
          <>
            <h2 className="mb-1 text-lg font-semibold tracking-tight">
              Set up the draft
            </h2>
            <p className="mb-4 text-sm text-ink-soft">
              Snake order comes from team creation order. Captains are already
              on their rosters; {eligible.length} players are in the pool.
            </p>
            <DraftSetupForm
              slug={slug}
              seasonId={season.id}
              teamCount={teams.length}
              eligibleCount={eligible.length}
            />
          </>
        ) : (
          <EmptyState
            icon={<IconWhistle size={26} />}
            title="Draft hasn't been created"
            body="The commissioner will open the draft room soon."
          />
        )}
      </div>
    );
  }

  const myTeam = teams.find((t) => t.captain_id === user.id) ?? null;
  const [picks, queue] = await Promise.all([
    getDraftPicks(draft.id),
    myTeam ? getDraftQueue(draft.id, myTeam.id) : Promise.resolve([]),
  ]);

  return (
    <DraftRoom
      slug={slug}
      draft={draft}
      picks={picks}
      teams={teams}
      eligible={eligible}
      queue={queue}
      myTeamId={myTeam?.id ?? null}
      isAdmin={admin}
    />
  );
}
