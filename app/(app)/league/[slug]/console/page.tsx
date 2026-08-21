import type { Metadata } from "next";
import { Panel } from "@/components/ui";
import { notFound, redirect } from "next/navigation";
import {
  getActiveSeason,
  getAnnouncements,
  getLeague,
  getLeagueFootprint,
  getSeasons,
  getTimeSlots,
  getVenues,
} from "@/lib/data";
import { isLeagueAdmin } from "@core/league-constants";
import { DEFAULT_APPEARANCE, parseAppearance } from "@core/theme";
import { deleteTimeSlot, deleteVenue, setSeasonStatus } from "../actions";
import {
  AddTimeSlotForm,
  AddVenueForm,
  AnnouncementForm,
  CreateSeasonForm,
  LeagueAppearanceForm,
  LeagueLogoForm,
  LeagueSettingsForm,
} from "./console-forms";
import { DangerZone } from "./danger-zone";

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

  const commissioner = league.role === "commissioner";
  const appearance = parseAppearance(league.settings?.appearance, DEFAULT_APPEARANCE);
  const [seasons, activeSeason, slots, venues, footprint, announcements] =
    await Promise.all([
      getSeasons(league.id),
      getActiveSeason(league.id),
      getTimeSlots(league.id),
      getVenues(league.id),
      commissioner ? getLeagueFootprint(league.id) : Promise.resolve(null),
      getAnnouncements(league.id),
    ]);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel eyebrow="Identity" title="Logo">
          <LeagueLogoForm
            slug={slug}
            name={league.name}
            color={league.primary_color}
            logoUrl={league.logo_url}
          />
        </Panel>
        <Panel eyebrow="Identity" title="League settings">
          <LeagueSettingsForm
            slug={slug}
            name={league.name}
            color={league.primary_color}
            emailDomain={league.settings?.email_domain ?? ""}
            tradeApproval={league.settings?.trade_approval ?? "commissioner"}
            jerseyNumbers={league.settings?.jersey_numbers !== false}
          />
        </Panel>
      </div>

      <Panel
        eyebrow="Appearance"
        title="How the league looks"
        action={
          <p className="max-w-xs text-right text-[13px] text-ink-body">
            Anyone can override this for themselves from their profile.
          </p>
        }
      >
        <LeagueAppearanceForm
          slug={slug}
          preset={appearance.preset}
          accent={appearance.accent}
        />
      </Panel>

      <Panel eyebrow="Megaphone" title="Announcements">
        <p className="mb-4 text-[13.5px] text-ink-muted">
          Lands in every member&apos;s inbox, and buzzes every phone and watch
          with the app installed.
        </p>
        <AnnouncementForm slug={league.slug} />
        {announcements.length > 0 ? (
          <ul className="mt-5 space-y-3 border-t border-rule pt-4">
            {announcements.map((a) => (
              <li key={a.id}>
                <p className="text-[15px] font-semibold">{a.title}</p>
                {a.body ? (
                  <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-muted">{a.body}</p>
                ) : null}
                <p className="label mt-1 !text-[10px] !text-ink-faint">
                  {a.author_name ?? "League admin"} ·{" "}
                  {new Date(a.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>

      <Panel eyebrow="Calendar" title="Seasons">
        <p className="mb-4 text-sm text-ink-body">
          The newest season is the active one everywhere in the app.
        </p>
        {seasons.length > 0 ? (
          <ul className="mb-5 space-y-2">
            {seasons.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-panel bg-paper px-4 py-3"
              >
                <div>
                  <p className="font-semibold">
                    {s.name}
                    {activeSeason?.id === s.id ? (
                      <span className="ml-2 rounded-full bg-ink px-2 py-0.5 text-xs font-semibold text-on-ink">
                        current
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm text-ink-body">
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
                      <button className="min-h-11 rounded-control bg-surface px-4 text-sm font-medium hover:bg-paper">
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
      </Panel>

      <Panel eyebrow="When games fit" title="Time slots">
        <p className="mb-4 text-sm text-ink-body">
          Named school periods that games are scheduled into — the scheduler
          only uses these.
        </p>
        {slots.length > 0 ? (
          <ul className="mb-5 grid gap-2 sm:grid-cols-2">
            {slots.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-panel bg-paper px-4 py-3"
              >
                <div>
                  <p className="font-semibold">{s.label}</p>
                  <p className="text-sm text-ink-body">
                    {DAYS[s.day_of_week]} · {s.start_time.slice(0, 5)}–
                    {s.end_time.slice(0, 5)} · {KIND_LABEL[s.kind]}
                  </p>
                </div>
                <form action={deleteTimeSlot}>
                  <input type="hidden" name="slot_id" value={s.id} />
                  <input type="hidden" name="slug" value={slug} />
                  <button className="min-h-11 rounded-control px-3 text-sm font-medium text-accent-ink hover:bg-tint">
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-sm font-medium text-accent-ink">
            No slots yet — the scheduler needs at least one.
          </p>
        )}
        <AddTimeSlotForm slug={slug} leagueId={league.id} />
      </Panel>

      <Panel eyebrow="Where they're played" title="Venues">
        <p className="mb-4 text-sm text-ink-body">
          One game per venue per slot, or two when splittable.
        </p>
        {venues.length > 0 ? (
          <ul className="mb-5 grid gap-2 sm:grid-cols-2">
            {venues.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between gap-3 rounded-panel bg-paper px-4 py-3"
              >
                <p className="font-semibold">
                  {v.name}
                  {v.splittable ? (
                    <span className="ml-2 text-xs font-medium text-ink-body">
                      splittable
                    </span>
                  ) : null}
                </p>
                <form action={deleteVenue}>
                  <input type="hidden" name="venue_id" value={v.id} />
                  <input type="hidden" name="slug" value={slug} />
                  <button className="min-h-11 rounded-control px-3 text-sm font-medium text-accent-ink hover:bg-tint">
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-sm font-medium text-accent-ink">
            No venues yet — add your gym.
          </p>
        )}
        <AddVenueForm slug={slug} leagueId={league.id} />
      </Panel>

      {commissioner && footprint ? (
        <DangerZone
          leagueId={league.id}
          leagueName={league.name}
          counts={footprint}
        />
      ) : null}
    </div>
  );
}
