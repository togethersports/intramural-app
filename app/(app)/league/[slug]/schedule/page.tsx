import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GameCard } from "@/components/game-card";
import { IconCalendar } from "@/components/icons";
import { EmptyState } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import {
  getActiveSeason,
  getGames,
  getLeague,
  getTeams,
  getTimeSlots,
  getVenues,
} from "@/lib/data";
import { getLeagueMembers } from "@/lib/leagues";
import { isLeagueAdmin } from "@/lib/league-constants";
import { deleteGame, rescheduleGame, setScorekeeper } from "../actions";
import { AddGameForm, GenerateScheduleForm } from "./schedule-forms";

export const metadata: Metadata = { title: "Schedule" };

export default async function SchedulePage({
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
          icon={<IconCalendar size={26} />}
          title="No season yet"
          body="The schedule appears once a season exists."
        />
      </div>
    );
  }

  const [games, teams, slots, venues, members] = await Promise.all([
    getGames(season.id),
    getTeams(season.id),
    getTimeSlots(league.id),
    getVenues(league.id),
    admin ? getLeagueMembers(league.id) : Promise.resolve([]),
  ]);

  const byWeek = new Map<number, typeof games>();
  for (const g of games) {
    if (!byWeek.has(g.week)) byWeek.set(g.week, []);
    byWeek.get(g.week)!.push(g);
  }
  const weeks = [...byWeek.keys()].sort((a, b) => a - b);

  return (
    <div className="space-y-5">
      {admin ? (
        <section className="card space-y-5 p-5 sm:p-6">
          <div>
            <h2 className="mb-3 text-lg font-semibold tracking-tight">
              Build the schedule
            </h2>
            <GenerateScheduleForm
              slug={slug}
              leagueId={league.id}
              seasonId={season.id}
            />
          </div>
          {teams.length >= 2 ? (
            <div className="border-t border-rule pt-4">
              <h3 className="mb-3 text-sm font-semibold text-ink-body">
                Or add a game manually
              </h3>
              <AddGameForm
                slug={slug}
                seasonId={season.id}
                teams={teams}
                slots={slots}
                venues={venues}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {weeks.length === 0 ? (
        <div className="card p-6">
          <EmptyState
            icon={<IconCalendar size={26} />}
            title="No games scheduled"
            body={
              admin
                ? "Auto-generate above once teams and availability are in."
                : "The commissioner hasn't built the schedule yet."
            }
          />
        </div>
      ) : (
        weeks.map((week) => (
          <section key={week} className="card p-5 sm:p-6">
            <h2 className="mb-4 text-lg font-semibold tracking-tight">
              {byWeek.get(week)!.some((g) => g.is_playoff)
                ? `Playoffs — round ${week - season.num_weeks}`
                : `Week ${week}`}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {byWeek.get(week)!.map((g) => (
                <div key={g.id} className="space-y-2">
                  <GameCard game={g} slug={slug} />
                  {admin && g.status !== "final" ? (
                    <details className="rounded-panel bg-paper px-3 py-2">
                      <summary className="min-h-11 cursor-pointer py-2 text-xs font-semibold text-ink-body">
                        Manage game
                      </summary>
                      <div className="space-y-3 pb-2 pt-1">
                        <form
                          action={rescheduleGame}
                          className="flex flex-wrap items-end gap-2"
                        >
                          <input type="hidden" name="game_id" value={g.id} />
                          <input type="hidden" name="slug" value={slug} />
                          <label className="text-xs font-medium text-ink-body">
                            Week
                            <input
                              name="week"
                              type="number"
                              min={1}
                              max={30}
                              defaultValue={g.week}
                              className="tabular mt-1 block h-11 w-16 rounded-control border border-rule bg-paper px-2 text-sm"
                            />
                          </label>
                          <label className="text-xs font-medium text-ink-body">
                            Date
                            <input
                              name="scheduled_date"
                              type="date"
                              defaultValue={g.scheduled_date ?? ""}
                              className="mt-1 block h-11 rounded-control border border-rule bg-paper px-2 text-sm"
                            />
                          </label>
                          <label className="text-xs font-medium text-ink-body">
                            Slot
                            <select
                              name="time_slot_id"
                              defaultValue={g.time_slot_id ?? ""}
                              className="mt-1 block h-11 w-28 rounded-control border border-rule bg-paper px-2 text-sm"
                            >
                              <option value="">—</option>
                              {slots.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="text-xs font-medium text-ink-body">
                            Venue
                            <select
                              name="venue_id"
                              defaultValue={g.venue_id ?? ""}
                              className="mt-1 block h-11 w-28 rounded-control border border-rule bg-paper px-2 text-sm"
                            >
                              <option value="">—</option>
                              {venues.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="text-xs font-medium text-ink-body">
                            Status
                            <select
                              name="status"
                              defaultValue={g.status}
                              className="mt-1 block h-11 w-28 rounded-control border border-rule bg-paper px-2 text-sm"
                            >
                              <option value="scheduled">Scheduled</option>
                              <option value="postponed">Postponed</option>
                              <option value="forfeit">Forfeit</option>
                            </select>
                          </label>
                          <button className="min-h-11 rounded-control bg-ink px-3 text-xs font-bold text-surface">
                            Save + notify
                          </button>
                        </form>
                        <div className="flex flex-wrap items-center gap-2">
                          <form action={setScorekeeper} className="flex items-center gap-2">
                            <input type="hidden" name="game_id" value={g.id} />
                            <input type="hidden" name="slug" value={slug} />
                            <input type="hidden" name="league_id" value={league.id} />
                            <select
                              name="user_id"
                              defaultValue={g.scorekeeper_id ?? ""}
                              className="h-11 rounded-control border border-rule bg-paper px-2 text-xs"
                            >
                              <option value="">No scorekeeper</option>
                              {members.map((m) => (
                                <option key={m.user_id} value={m.user_id}>
                                  {m.full_name}
                                </option>
                              ))}
                            </select>
                            <button className="min-h-11 rounded-control bg-rule px-3 text-xs font-semibold">
                              Assign scorekeeper
                            </button>
                          </form>
                          <form action={deleteGame}>
                            <input type="hidden" name="game_id" value={g.id} />
                            <input type="hidden" name="slug" value={slug} />
                            <button className="min-h-11 rounded-control px-3 text-xs font-semibold text-accent hover:bg-tint">
                              Delete
                            </button>
                          </form>
                        </div>
                      </div>
                    </details>
                  ) : null}
                  {(admin || g.scorekeeper_id === user.id) &&
                  (g.status === "scheduled" || g.status === "live") ? (
                    <Link
                      href={`/league/${slug}/game/${g.id}/track`}
                      className="flex min-h-11 items-center justify-center rounded-control bg-ink text-sm font-semibold text-surface hover:bg-black"
                    >
                      {g.status === "live" ? "Resume tracking" : "Track this game"}
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
