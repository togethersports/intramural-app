"use client";

import { useActionState } from "react";
import {
  createGame,
  generateScheduleAction,
  type ActionState,
} from "../actions";
import { Button, Field, FormError, Input, Select } from "@/components/ui";
import type { TeamRow, TimeSlotRow, VenueRow } from "@/lib/types";

const initialGen: ActionState & {
  conflicts?: { matchup: string; reason: string }[];
} = { error: null };

export function GenerateScheduleForm({
  slug,
  leagueId,
  seasonId,
}: {
  slug: string;
  leagueId: string;
  seasonId: string;
}) {
  const [state, formAction, pending] = useActionState(
    generateScheduleAction,
    initialGen,
  );
  return (
    <div className="space-y-3">
      <form action={formAction} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="league_id" value={leagueId} />
        <input type="hidden" name="season_id" value={seasonId} />
        <Button type="submit" disabled={pending} variant="accent">
          {pending ? "Solving…" : "Auto-generate schedule"}
        </Button>
        <span className="text-xs text-ink-faint">
          Replaces unplayed regular-season games. Uses availability, venue
          capacity, and slot equity.
        </span>
      </form>
      <FormError message={state.error} />
      {state.notice ? (
        <p className="rounded-control bg-sage/20 px-4 py-2.5 text-sm font-medium text-sage-deep">
          {state.notice}
        </p>
      ) : null}
      {state.conflicts && state.conflicts.length > 0 ? (
        <div className="rounded-panel bg-accent-wash p-4">
          <p className="mb-2 text-sm font-bold text-accent-deep">
            Conflict report — {state.conflicts.length} matchup
            {state.conflicts.length > 1 ? "s" : ""} could not be placed
          </p>
          <ul className="space-y-1 text-sm text-accent-deep">
            {state.conflicts.map((c, i) => (
              <li key={i}>
                <span className="font-semibold">{c.matchup}:</span> {c.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function AddGameForm({
  slug,
  seasonId,
  teams,
  slots,
  venues,
}: {
  slug: string;
  seasonId: string;
  teams: TeamRow[];
  slots: TimeSlotRow[];
  venues: VenueRow[];
}) {
  const [state, formAction, pending] = useActionState(createGame, {
    error: null,
  });
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <FormError message={state.error} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="season_id" value={seasonId} />
      <Field label="Week" htmlFor="g-week">
        <Input id="g-week" name="week" type="number" min={1} max={30} defaultValue={1} className="w-20" />
      </Field>
      <Field label="Home" htmlFor="g-home">
        <Select id="g-home" name="home_team_id" required className="w-40">
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Away" htmlFor="g-away">
        <Select id="g-away" name="away_team_id" required defaultValue={teams[1]?.id} className="w-40">
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Date" htmlFor="g-date">
        <Input id="g-date" name="scheduled_date" type="date" className="w-40" />
      </Field>
      <Field label="Slot" htmlFor="g-slot">
        <Select id="g-slot" name="time_slot_id" defaultValue="" className="w-36">
          <option value="">—</option>
          {slots.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </Select>
      </Field>
      <Field label="Venue" htmlFor="g-venue">
        <Select id="g-venue" name="venue_id" defaultValue="" className="w-36">
          <option value="">—</option>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </Select>
      </Field>
      <Button type="submit" disabled={pending} variant="soft">
        {pending ? "Adding…" : "Add game"}
      </Button>
    </form>
  );
}
