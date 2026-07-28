"use client";

import { useActionState } from "react";
import {
  addTimeSlot,
  addVenue,
  createSeason,
  updateLeagueSettings,
  type ActionState,
} from "../actions";
import { Button, Field, FormError, Input, Select } from "@/components/ui";

const initial: ActionState = { error: null };

export function LeagueSettingsForm({
  slug,
  name,
  color,
  emailDomain,
  tradeApproval,
}: {
  slug: string;
  name: string;
  color: string;
  emailDomain: string;
  tradeApproval: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateLeagueSettings,
    initial,
  );
  return (
    <form action={formAction} className="space-y-3">
      <FormError message={state.error} />
      {state.notice ? (
        <p className="rounded-control bg-sage/20 px-4 py-2.5 text-sm font-medium text-sage-deep">
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
      <Button type="submit" disabled={pending} variant="soft">
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
      <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-ink-soft">
        <input type="checkbox" name="splittable" className="size-4 accent-ink" />
        Splittable (two half-court games)
      </label>
      <Button type="submit" disabled={pending} variant="soft">
        {pending ? "Adding…" : "Add venue"}
      </Button>
    </form>
  );
}
