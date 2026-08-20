"use client";

import { useActionState, useState } from "react";
import { Button, Field, FormError, Input, Select } from "@/components/ui";
import type { GameRules } from "@core/game-rules";
import { createAdhocGame, type ActionState } from "../../actions";

const initial: ActionState = { error: null };

interface Option {
  id: string;
  name: string;
}

function TeamPicker({
  side,
  label,
  teams,
  onGuestChange,
}: {
  side: "home" | "away";
  label: string;
  teams: Option[];
  onGuestChange: (isGuest: boolean) => void;
}) {
  const [guest, setGuest] = useState(teams.length === 0);
  return (
    <Field label={label} htmlFor={`${side}_team`}>
      <div className="space-y-2">
        <Select
          id={`${side}_team`}
          name={`${side}_team_id`}
          defaultValue={teams.length === 0 ? "__guest" : ""}
          required
          onChange={(e) => {
            const g = e.target.value === "__guest";
            setGuest(g);
            onGuestChange(g);
          }}
        >
          <option value="" disabled>
            Pick a team
          </option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
          <option value="__guest">Visiting team — type a name</option>
        </Select>
        {guest ? (
          <Input
            name={`${side}_guest_name`}
            placeholder="Faculty All-Stars"
            minLength={2}
            required
            aria-label={`${label} name`}
          />
        ) : null}
      </div>
    </Field>
  );
}

/** One screen, fast, forgiving: two teams (or free-text visitors), optional
    where/when, per-game rule overrides prefilled from the league rules,
    then straight into the console. */
export function NewGameForm({
  slug,
  seasonId,
  teams,
  venues,
  defaults,
}: {
  slug: string;
  seasonId: string;
  teams: Option[];
  venues: Option[];
  defaults: GameRules;
}) {
  const [state, formAction, pending] = useActionState(createAdhocGame, initial);
  const [guestSides, setGuestSides] = useState({ home: teams.length === 0, away: teams.length === 0 });
  // Exhibition by default when either side isn't a league team; the
  // commissioner can override either way.
  const anyGuest = guestSides.home || guestSides.away;

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={state.error} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="season_id" value={seasonId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <TeamPicker
          side="home"
          label="Home team"
          teams={teams}
          onGuestChange={(g) => setGuestSides((s) => ({ ...s, home: g }))}
        />
        <TeamPicker
          side="away"
          label="Away team"
          teams={teams}
          onGuestChange={(g) => setGuestSides((s) => ({ ...s, away: g }))}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Gym" htmlFor="venue_id" hint="Optional.">
          <Select id="venue_id" name="venue_id" defaultValue="">
            <option value="">—</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date" htmlFor="scheduled_date" hint="Defaults to today.">
          <Input
            id="scheduled_date"
            name="scheduled_date"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </Field>
      </div>

      <div className="rounded-panel bg-paper p-4">
        <p className="label mb-3">
          Game rules — from the league rules, editable for this game only
        </p>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Periods" htmlFor="periods">
            <Input
              id="periods"
              name="periods"
              type="number"
              min={1}
              max={8}
              defaultValue={defaults.periods}
              className="tabular"
            />
          </Field>
          <Field label="Minutes" htmlFor="period_minutes">
            <Input
              id="period_minutes"
              name="period_minutes"
              type="number"
              min={1}
              max={60}
              defaultValue={defaults.periodMinutes}
              className="tabular"
            />
          </Field>
          <Field label="Foul limit" htmlFor="foul_limit">
            <Input
              id="foul_limit"
              name="foul_limit"
              type="number"
              min={1}
              max={10}
              defaultValue={defaults.foulLimit}
              className="tabular"
            />
          </Field>
        </div>
      </div>

      <label className="flex min-h-11 items-start gap-3 rounded-panel bg-paper p-4">
        {/* key remounts the checkbox so the default tracks guest selection
            until the commissioner decides for themselves */}
        <input
          key={anyGuest ? "exhibition" : "counts"}
          type="checkbox"
          name="counts"
          defaultChecked={!anyGuest}
          className="mt-1 size-5 accent-ink"
        />
        <span>
          <span className="block font-semibold">Counts toward standings</span>
          <span className="block text-sm text-ink-body">
            Leave off for scrimmages, pickup games, and visiting teams — the
            box score is still kept.
          </span>
        </span>
      </label>

      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          name="mode"
          value="start"
          variant="accent"
          disabled={pending}
        >
          {pending ? "Creating…" : "Start now"}
        </Button>
        <Button
          type="submit"
          name="mode"
          value="save"
          variant="quiet"
          disabled={pending}
        >
          Save for later
        </Button>
      </div>
      <p className="text-sm text-ink-muted">
        Start now opens the live console. Either way the game shows up on the
        schedule, and every setting stays editable mid-game.
      </p>
    </form>
  );
}
