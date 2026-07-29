import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconUsers } from "@/components/icons";
import { Avatar, EmptyState, TeamBadge } from "@/components/ui";
import {
  getActiveSeason,
  getFreeAgents,
  getLeague,
  getTeamsWithRosters,
} from "@/lib/data";
import { isLeagueAdmin } from "@/lib/league-constants";
import { addPlayerToTeam, deleteTeam, removeFromTeam, setJersey } from "../actions";
import { CreateTeamForm } from "./team-forms";

export const metadata: Metadata = { title: "Teams" };

export default async function TeamsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeague(slug);
  if (!league) notFound();
  const admin = isLeagueAdmin(league.role);
  const season = await getActiveSeason(league.id);

  if (!season) {
    return (
      <div className="card p-6">
        <EmptyState
          icon={<IconUsers size={26} />}
          title="No season yet"
          body="Teams live inside a season — create one in the console first."
        />
      </div>
    );
  }

  const [teams, freeAgents] = await Promise.all([
    getTeamsWithRosters(season.id),
    getFreeAgents(league.id, season.id),
  ]);

  return (
    <div className="space-y-5">
      {admin ? (
        <section className="card p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold tracking-tight">
            Add a team
          </h2>
          <CreateTeamForm
            slug={slug}
            leagueId={league.id}
            seasonId={season.id}
            candidates={freeAgents}
          />
        </section>
      ) : null}

      {teams.length === 0 ? (
        <div className="card p-6">
          <EmptyState
            icon={<IconUsers size={26} />}
            title="No teams yet"
            body={
              admin
                ? "Add teams with captains, then run the draft to fill rosters."
                : "Teams appear once the commissioner creates them."
            }
          />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {teams.map((team) => (
            <section key={team.id} className="card overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-rule px-5 py-4">
                <Link
                  href={`/league/${slug}/team/${team.id}`}
                  className="flex items-center gap-3"
                >
                  <TeamBadge abbrev={team.abbrev} color={team.color} size={36} />
                  <span className="text-[19px] font-semibold tracking-tight hover:underline">
                    {team.name}
                  </span>
                </Link>
                <span className="label">{team.roster.length} players</span>
              </div>
              <ul className="divide-y divide-rule px-3 py-2">
                {team.roster.length === 0 ? (
                  <li className="px-2 py-3 text-sm text-ink-faint">
                    Empty roster — fill it in the draft.
                  </li>
                ) : (
                  team.roster.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 px-2 py-2.5">
                      <Avatar name={m.full_name} size={34} />
                      <Link
                        href={`/league/${slug}/player/${m.user_id}`}
                        className="min-w-0 flex-1 truncate text-sm font-semibold hover:underline"
                      >
                        {m.full_name}
                        {m.is_captain ? (
                          <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white">
                            C
                          </span>
                        ) : null}
                      </Link>
                      {admin ? (
                        <form action={setJersey} className="flex items-center gap-1">
                          <input type="hidden" name="member_id" value={m.id} />
                          <input type="hidden" name="slug" value={slug} />
                          <span className="text-xs text-ink-faint">#</span>
                          <input
                            name="jersey_number"
                            type="number"
                            min={0}
                            max={99}
                            defaultValue={m.jersey_number ?? ""}
                            className="tabular h-11 w-14 rounded-control border border-rule bg-paper px-2 text-center text-sm"
                          />
                          <button className="min-h-11 rounded-control px-2 text-xs font-semibold text-ink-body hover:bg-surface">
                            Set
                          </button>
                        </form>
                      ) : (
                        <span className="tabular text-sm text-ink-body">
                          {m.jersey_number != null ? `#${m.jersey_number}` : ""}
                        </span>
                      )}
                      {admin && !m.is_captain ? (
                        <form action={removeFromTeam}>
                          <input type="hidden" name="member_id" value={m.id} />
                          <input type="hidden" name="slug" value={slug} />
                          <button className="min-h-11 rounded-control px-2 text-xs font-semibold text-accent hover:bg-tint">
                            Cut
                          </button>
                        </form>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>
              {admin ? (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rule px-5 py-3">
                  {freeAgents.length > 0 ? (
                    <form action={addPlayerToTeam} className="flex items-center gap-2">
                      <input type="hidden" name="team_id" value={team.id} />
                      <input type="hidden" name="slug" value={slug} />
                      <select
                        name="user_id"
                        className="h-11 rounded-control border border-rule bg-paper px-2 text-sm"
                        defaultValue=""
                        required
                      >
                        <option value="" disabled>
                          Add free agent…
                        </option>
                        {freeAgents.map((f) => (
                          <option key={f.user_id} value={f.user_id}>
                            {f.full_name}
                          </option>
                        ))}
                      </select>
                      <button className="min-h-11 rounded-control bg-rule px-3 text-sm font-medium hover:bg-surface">
                        Add
                      </button>
                    </form>
                  ) : (
                    <span className="text-xs text-ink-faint">No free agents</span>
                  )}
                  <form action={deleteTeam}>
                    <input type="hidden" name="team_id" value={team.id} />
                    <input type="hidden" name="slug" value={slug} />
                    <button className="min-h-11 rounded-control px-3 text-xs font-semibold text-accent hover:bg-tint">
                      Delete team
                    </button>
                  </form>
                </div>
              ) : null}
            </section>
          ))}
        </div>
      )}

      {freeAgents.length > 0 ? (
        <section className="card p-5 sm:p-6">
          <h2 className="mb-3 text-lg font-semibold tracking-tight">
            Free agents
          </h2>
          <div className="flex flex-wrap gap-2">
            {freeAgents.map((f) => (
              <span
                key={f.user_id}
                className="inline-flex items-center gap-2 rounded-full bg-rule px-3 py-1.5 text-sm font-medium"
              >
                <Avatar name={f.full_name} size={22} />
                {f.full_name}
                {f.grade ? (
                  <span className="text-xs text-ink-faint">gr {f.grade}</span>
                ) : null}
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
