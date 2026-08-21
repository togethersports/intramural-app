"use client";

import { useActionState, useRef, useState } from "react";
import {
  addTimeSlot,
  addVenue,
  announceLeague,
  createSeason,
  updateLeagueAppearance,
  updateLeagueLogo,
  updateLeagueSettings,
  type ActionState,
} from "../actions";
import { AppearancePicker } from "@/components/appearance-picker";
import { IconCamera } from "@/components/icons";
import {
  Button,
  Field,
  FormError,
  FormNotice,
  Input,
  Select,
} from "@/components/ui";
import type { ThemePreset } from "@core/theme";

const initial: ActionState = { error: null };

/** The league crest. Editable at any point in the season, by design — a
 *  league that renames itself in week 6 should not have to start over. */
export function LeagueLogoForm({
  slug,
  name,
  color,
  logoUrl,
}: {
  slug: string;
  name: string;
  color: string;
  logoUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateLeagueLogo, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const shown = preview ?? logoUrl;

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <div className="flex flex-wrap items-center gap-4">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shown}
            alt=""
            className="size-20 shrink-0 rounded-[20px] object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="grid size-20 shrink-0 place-items-center rounded-[20px] text-[30px] font-semibold text-white"
            style={{ backgroundColor: color }}
          >
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="space-y-2">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-ink px-5 text-[15px] font-semibold text-on-ink transition-opacity hover:opacity-90">
            <IconCamera size={17} />
            {logoUrl ? "Change logo" : "Add a logo"}
            <input
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setPreview(URL.createObjectURL(file));
                formRef.current?.requestSubmit();
              }}
            />
          </label>
          <p className="text-[13px] text-ink-body">
            Square works best. Up to 4 MB.
          </p>
        </div>
        {logoUrl ? (
          <Button
            type="submit"
            name="intent"
            value="remove"
            variant="quiet"
            className="!min-h-11 !px-4 !text-[15px]"
            onClick={() => setPreview(null)}
          >
            Remove
          </Button>
        ) : null}
      </div>
      {pending ? (
        <p className="text-[15px] text-ink-body">Uploading…</p>
      ) : (
        <>
          <FormError message={state.error} />
          <FormNotice message={state.notice} />
        </>
      )}
    </form>
  );
}

/** The palette everyone in the league gets, unless they set their own. */
export function LeagueAppearanceForm({
  slug,
  preset,
  accent,
}: {
  slug: string;
  preset: ThemePreset;
  accent: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateLeagueAppearance,
    initial,
  );
  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="slug" value={slug} />
      <FormError message={state.error} />
      <FormNotice message={state.notice} />
      <AppearancePicker defaultPreset={preset} defaultAccent={accent} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Apply to the whole league"}
      </Button>
    </form>
  );
}

export function LeagueSettingsForm({
  slug,
  name,
  color,
  emailDomain,
  tradeApproval,
  jerseyNumbers,
}: {
  slug: string;
  name: string;
  color: string;
  emailDomain: string;
  tradeApproval: string;
  jerseyNumbers: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateLeagueSettings,
    initial,
  );
  return (
    <form action={formAction} className="space-y-3">
      <FormError message={state.error} />
      {state.notice ? (
        <p className="rounded-control bg-ink px-4 py-2.5 text-sm font-medium text-on-ink">
          {state.notice}
        </p>
      ) : null}
      <input type="hidden" name="slug" value={slug} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="League name" htmlFor="ls-name">
          <Input id="ls-name" name="name" defaultValue={name} required />
        </Field>
        <Field label="League color" htmlFor="ls-color">
          <Input
            id="ls-color"
            name="color"
            type="color"
            defaultValue={color}
            className="h-11 p-1.5"
          />
        </Field>
        <Field
          label="Email domain restriction"
          htmlFor="ls-domain"
          hint="Only these emails can join. Leave blank for open joining."
        >
          <Input
            id="ls-domain"
            name="email_domain"
            placeholder="school.org"
            defaultValue={emailDomain}
          />
        </Field>
        <Field label="Trade approval" htmlFor="ls-trades">
          <Select id="ls-trades" name="trade_approval" defaultValue={tradeApproval}>
            <option value="commissioner">Commissioner approves</option>
            <option value="auto">Auto-approve on accept</option>
          </Select>
        </Field>
      </div>
      {/* Plenty of intramural leagues play in whatever shirt people wore
          that day. Off hides the numbers instead of leaving empty slots. */}
      <label className="row flex min-h-11 cursor-pointer items-start gap-3 px-4 py-3">
        <input
          type="checkbox"
          name="jersey_numbers"
          defaultChecked={jerseyNumbers}
          className="mt-1 size-5 shrink-0 accent-[var(--color-ink)]"
        />
        <span>
          <span className="block text-[17px] font-medium leading-snug">
            Use jersey numbers
          </span>
          <span className="block text-sm leading-snug text-ink-muted">
            Off for leagues that don&apos;t hand out shirts — numbers disappear
            from rosters and team pages instead of sitting there blank.
          </span>
        </span>
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}

export function CreateSeasonForm({
  slug,
  leagueId,
}: {
  slug: string;
  leagueId: string;
}) {
  const [state, formAction, pending] = useActionState(createSeason, initial);
  return (
    <form action={formAction} className="space-y-3">
      <FormError message={state.error} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="league_id" value={leagueId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Season name" htmlFor="cs-name">
          <Input id="cs-name" name="name" placeholder="Winter 2026" required />
        </Field>
        <Field label="Start date" htmlFor="cs-start">
          <Input id="cs-start" name="starts_on" type="date" required />
        </Field>
        <Field label="Regular-season weeks" htmlFor="cs-weeks">
          <Input
            id="cs-weeks"
            name="num_weeks"
            type="number"
            min={1}
            max={20}
            defaultValue={6}
          />
        </Field>
        <Field label="Min players per slot" htmlFor="cs-min" hint="Scheduler availability threshold.">
          <Input id="cs-min" name="min_players" type="number" min={1} max={11} defaultValue={4} />
        </Field>
        <Field label="Roster min / max" htmlFor="cs-rmin">
          <div className="flex gap-2">
            <Input id="cs-rmin" name="roster_min" type="number" min={1} max={20} defaultValue={4} />
            <Input name="roster_max" type="number" min={1} max={20} defaultValue={10} />
          </div>
        </Field>
        <Field label="Max games per team per week" htmlFor="cs-max">
          <Input id="cs-max" name="max_games_week" type="number" min={1} max={5} defaultValue={1} />
        </Field>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create season"}
      </Button>
    </form>
  );
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function AddTimeSlotForm({
  slug,
  leagueId,
}: {
  slug: string;
  leagueId: string;
}) {
  const [state, formAction, pending] = useActionState(addTimeSlot, initial);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <FormError message={state.error} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="league_id" value={leagueId} />
      <Field label="Label" htmlFor="ts-label">
        <Input id="ts-label" name="label" placeholder="Lunch A" required className="w-36" />
      </Field>
      <Field label="Day" htmlFor="ts-day">
        <Select id="ts-day" name="day_of_week" defaultValue="1" className="w-36">
          {DAYS.map((d, i) => (
            <option key={d} value={i}>
              {d}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Start" htmlFor="ts-start">
        <Input id="ts-start" name="start_time" type="time" defaultValue="11:40" required className="w-28" />
      </Field>
      <Field label="End" htmlFor="ts-end">
        <Input id="ts-end" name="end_time" type="time" defaultValue="12:10" required className="w-28" />
      </Field>
      <Field label="Kind" htmlFor="ts-kind">
        <Select id="ts-kind" name="kind" defaultValue="lunch" className="w-36">
          <option value="lunch">Lunch</option>
          <option value="free">Free period</option>
          <option value="after_school">After school</option>
        </Select>
      </Field>
      <Button type="submit" disabled={pending} variant="quiet">
        {pending ? "Adding…" : "Add slot"}
      </Button>
    </form>
  );
}

export function AddVenueForm({
  slug,
  leagueId,
}: {
  slug: string;
  leagueId: string;
}) {
  const [state, formAction, pending] = useActionState(addVenue, initial);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <FormError message={state.error} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="league_id" value={leagueId} />
      <Field label="Venue name" htmlFor="v-name">
        <Input id="v-name" name="name" placeholder="Main Gym" required className="w-48" />
      </Field>
      <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-ink-body">
        <input type="checkbox" name="splittable" className="size-4 accent-ink" />
        Splittable (two half-court games)
      </label>
      <Button type="submit" disabled={pending} variant="quiet">
        {pending ? "Adding…" : "Add venue"}
      </Button>
    </form>
  );
}

/** One announcement, three deliveries: the record, every member's inbox,
 *  and a push to each registered phone and watch. The textarea is optional —
 *  a title alone ("Games cancelled today") is a complete announcement. */
export function AnnouncementForm({ slug }: { slug: string }) {
  const [state, formAction, pending] = useActionState(announceLeague, initial);
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={formRef}
      action={(fd) => {
        formAction(fd);
        formRef.current?.reset();
      }}
      className="space-y-3"
    >
      <FormError message={state.error} />
      {state.notice ? <FormNotice message={state.notice} /> : null}
      <input type="hidden" name="slug" value={slug} />
      <Field label="Title" htmlFor="ann-title">
        <Input
          id="ann-title"
          name="title"
          placeholder="Games cancelled today"
          maxLength={120}
          required
        />
      </Field>
      <Field label="Details (optional)" htmlFor="ann-body">
        <textarea
          id="ann-body"
          name="body"
          rows={3}
          maxLength={2000}
          placeholder="Main Gym is closed for the assembly. Everything moves to Thursday."
          className="w-full rounded-2xl border border-rule bg-paper px-4 py-3 text-[15px] text-ink outline-none placeholder:text-ink-faint focus:border-accent"
        />
      </Field>
      <Button type="submit" disabled={pending} variant="quiet">
        {pending ? "Posting…" : "Post to the whole league"}
      </Button>
    </form>
  );
}
