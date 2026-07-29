import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconCalendar } from "@/components/icons";
import { Button, EmptyState } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import {
  getActiveSeason,
  getLeague,
  getMyAvailability,
  getSeasonAvailability,
  getTeamsWithRosters,
  getTimeSlots,
} from "@/lib/data";
import { isLeagueAdmin } from "@/packages/core/league-constants";
import { nudgeAvailability } from "../actions";
import { AvailabilityGrid } from "./availability-grid";

export const metadata: Metadata = { title: "Availability" };

export default async function AvailabilityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();
  const league = await getLeague(slug);
  if (!league) notFound();
  const season = await getActiveSeason(league.id);
  const slots = await getTimeSlots(league.id);

  if (!season || slots.length === 0) {
    return (
      <div className="card p-6">
        <EmptyState
          icon={<IconCalendar size={26} />}
          title={season ? "No time slots defined" : "No season yet"}
          body={
            season
              ? "The commissioner needs to define lunch/free-period slots in the console."
              : "Availability opens once a season exists."
          }
        />
      </div>
    );
  }

  const [mine, teams] = await Promise.all([
    getMyAvailability(season.id, user.id),
    getTeamsWithRosters(season.id),
  ]);
  const initial = Object.fromEntries(
    mine.map((a) => [a.time_slot_id, a.status]),
  ) as Record<string, "yes" | "maybe" | "no">;

  const canSeeHeatmap =
    isLeagueAdmin(league.role) || teams.some((t) => t.captain_id === user.id);
  const all = canSeeHeatmap ? await getSeasonAvailability(season.id) : [];
  const byUser = new Map<string, Map<string, string>>();
  for (const a of all) {
    if (!byUser.has(a.user_id)) byUser.set(a.user_id, new Map());
    byUser.get(a.user_id)!.set(a.time_slot_id, a.status);
  }

  const heatColor = (count: number, rosterSize: number) => {
    if (rosterSize === 0) return "bg-rule text-ink-faint";
    if (count >= 5) return "bg-ink text-white";
    if (count >= 4) return "bg-bench text-white";
    if (count >= 3) return "bg-bench/50 text-ink";
    if (count > 0) return "bg-tint text-accent";
    return "bg-rule text-ink-faint";
  };

  return (
    <div className="space-y-5">
      <section className="card p-5 sm:p-6">
        <h2 className="mb-1 text-lg font-semibold tracking-tight">
          My weekly availability
        </h2>
        <p className="mb-4 text-sm text-ink-body">
          Tap once per slot — the scheduler uses this to place games when your
          team can actually play.
        </p>
        <AvailabilityGrid seasonId={season.id} slots={slots} initial={initial} />
      </section>

      {canSeeHeatmap ? (
        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Team heatmap
              </h2>
              <p className="text-sm text-ink-body">
                Players available per team per slot (yes + ½ maybe).
              </p>
            </div>
            <form action={nudgeAvailability}>
              <input type="hidden" name="season_id" value={season.id} />
              <input type="hidden" name="league_id" value={league.id} />
              <input type="hidden" name="slug" value={slug} />
              <Button type="submit" variant="quiet">
                Nudge non-submitters
              </Button>
            </form>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-faint">
                  <th className="py-2 pr-3 font-medium">Team</th>
                  {slots.map((s) => (
                    <th key={s.id} className="px-1.5 py-2 text-center font-medium">
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => (
                  <tr key={team.id} className="border-t border-rule">
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-2 font-semibold">
                        <span
                          aria-hidden
                          className="size-3 rounded-full"
                          style={{ backgroundColor: team.color }}
                        />
                        {team.name}
                      </span>
                    </td>
                    {slots.map((s) => {
                      let count = 0;
                      for (const m of team.roster) {
                        const st = byUser.get(m.user_id)?.get(s.id);
                        if (st === "yes") count += 1;
                        else if (st === "maybe") count += 0.5;
                      }
                      const n = Math.floor(count);
                      return (
                        <td key={s.id} className="px-1.5 py-1.5 text-center">
                          <span
                            className={`tabular inline-block min-w-9 rounded-control px-2 py-1.5 font-semibold ${heatColor(n, team.roster.length)}`}
                          >
                            {n}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
