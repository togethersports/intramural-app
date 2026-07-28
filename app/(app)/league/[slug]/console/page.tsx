import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  getActiveSeason,
  getLeague,
  getSeasons,
  getTimeSlots,
  getVenues,
} from "@/lib/data";
import { isLeagueAdmin } from "@/lib/league-constants";
import { deleteTimeSlot, deleteVenue, setSeasonStatus } from "../actions";
import {
  AddTimeSlotForm,
  AddVenueForm,
  CreateSeasonForm,
  LeagueSettingsForm,
} from "./console-forms";

export const metadata: Metadata = { title: "Console" };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const KIND_LABEL: Record<string, string> = {
  lunch: "Lunch",
  free: "Free period",
  after_school: "After school",
};

const SEASON_TRANSITIONS: Record<string, { to: string; label: string }[]> = {
  setup: [{ to: "active", label: "Skip draft, go active" }],
  draft: [{ to: "active", label: "Mark active" }],
  active: [],
  playoffs: [{ to: "complete", label: "Mark complete" }],
  complete: [],
};

export default async function ConsolePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeague(slug);
  if (!league) notFound();
  if (!isLeagueAdmin(league.role)) redirect(`/league/${slug}`);

  const [seasons, activeSeason, slots, venues] = await Promise.all([
    getSeasons(league.id),
    getActiveSeason(league.id),
    getTimeSlots(league.id),
    getVenues(league.id),
  ]);

  return (
    <div className="space-y-5">
      <section className="card p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">
          League settings
        </h2>
        <LeagueSettingsForm
          slug={slug}
          name={league.name}
          color={league.primary_color}
          emailDomain={league.settings?.email_domain ?? ""}
          tradeApproval={league.settings?.trade_approval ?? "commissioner"}
        />
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="mb-1 text-lg font-semibold tracking-tight">Seasons</h2>
        <p className="mb-4 text-sm text-ink-soft">
          The newest season is the active one everywhere in the app.
        </p>
        {seasons.length > 0 ? (
          <ul className="mb-5 space-y-2">
            {seasons.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-panel bg-surface-dim/60 px-4 py-3"
              >
                <div>
                  <p className="font-semibold">
                    {s.name}
                    {activeSeason?.id === s.id ? (
                      <span className="ml-2 rounded-full bg-ink px-2 py-0.5 text-xs font-semibold text-surface">
                        current
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm text-ink-soft">
                    {s.starts_on} · {s.num_weeks} weeks ·{" "}
                    <span className="capitalize">{s.status}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  {SEASON_TRANSITIONS[s.status]?.map((t) => (
                    <form key={t.to} action={setSeasonStatus}>
                      <input type="hidden" name="season_id" value={s.id} />
                      <input type="hidden" name="status" value={t.to} />
                      <input type="hidden" name="slug" value={slug} />
                      <button className="min-h-11 rounded-control bg-surface px-4 text-sm font-medium hover:bg-surface-bright">
                        {t.label}
                      </button>
                    </form>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        <CreateSeasonForm slug={slug} leagueId={league.id} />
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="mb-1 text-lg font-semibold tracking-tight">Time slots</h2>
        <p className="mb-4 text-sm text-ink-soft">
          Named school periods that games are scheduled into — the scheduler
          only uses these.
        </p>
        {slots.length > 0 ? (
          <ul className="mb-5 grid gap-2 sm:grid-cols-2">
            {slots.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-panel bg-surface-dim/60 px-4 py-3"
              >
                <div>
                  <p className="font-semibold">{s.label}</p>
                  <p className="text-sm text-ink-soft">
                    {DAYS[s.day_of_week]} · {s.start_time.slice(0, 5)}–
                    {s.end_time.slice(0, 5)} · {KIND_LABEL[s.kind]}
                  </p>
                </div>
                <form action={deleteTimeSlot}>
                  <input type="hidden" name="slot_id" value={s.id} />
                  <input type="hidden" name="slug" value={slug} />
                  <button className="min-h-11 rounded-control px-3 text-sm font-medium text-accent-deep hover:bg-accent-wash">
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-sm font-medium text-amber">
            No slots yet — the scheduler needs at least one.
          </p>
        )}
        <AddTimeSlotForm slug={slug} leagueId={league.id} />
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="mb-1 text-lg font-semibold tracking-tight">Venues</h2>
        <p className="mb-4 text-sm text-ink-soft">
          One game per venue per slot, or two when splittable.
        </p>
        {venues.length > 0 ? (
          <ul className="mb-5 grid gap-2 sm:grid-cols-2">
            {venues.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between gap-3 rounded-panel bg-surface-dim/60 px-4 py-3"
              >
                <p className="font-semibold">
                  {v.name}
                  {v.splittable ? (
                    <span className="ml-2 text-xs font-medium text-ink-soft">
                      splittable
                    </span>
                  ) : null}
                </p>
                <form action={deleteVenue}>
                  <input type="hidden" name="venue_id" value={v.id} />
                  <input type="hidden" name="slug" value={slug} />
                  <button className="min-h-11 rounded-control px-3 text-sm font-medium text-accent-deep hover:bg-accent-wash">
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-sm font-medium text-amber">
            No venues yet — add your gym.
          </p>
        )}
        <AddVenueForm slug={slug} leagueId={league.id} />
      </section>
    </div>
  );
}
