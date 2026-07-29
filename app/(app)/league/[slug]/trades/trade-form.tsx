"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { proposeTradeAction, type ActionState } from "../actions";
import { Button, Field, FormError, Select } from "@/components/ui";
import type { TeamWithRoster } from "@core/types";

const initial: ActionState = { error: null };

export function TradeForm({
  slug,
  seasonId,
  myTeam,
  teams,
}: {
  slug: string;
  seasonId: string;
  myTeam: TeamWithRoster;
  teams: TeamWithRoster[];
}) {
  const [state, formAction, pending] = useActionState(proposeTradeAction, initial);
  const others = useMemo(
    () => teams.filter((t) => t.id !== myTeam.id),
    [teams, myTeam.id],
  );
  const [toTeamId, setToTeamId] = useState(others[0]?.id ?? "");
  const toTeam = others.find((t) => t.id === toTeamId);

  if (others.length === 0) return null;

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.error} />
      {state.notice ? (
        <p className="rounded-control bg-ink px-4 py-2.5 text-sm font-medium text-white">
          {state.notice}
        </p>
      ) : null}
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="season_id" value={seasonId} />
      <input type="hidden" name="from_team_id" value={myTeam.id} />
      <input type="hidden" name="to_team_id" value={toTeamId} />

      <Field label="Trade with" htmlFor="tr-team">
        <Select
          id="tr-team"
          value={toTeamId}
          onChange={(e) => setToTeamId(e.target.value)}
          className="max-w-xs"
        >
          {others.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset className="rounded-panel bg-paper p-4">
          <legend className="px-1 text-sm font-semibold">
            You send ({myTeam.name})
          </legend>
          {myTeam.roster
            .filter((r) => !r.is_captain)
            .map((r) => (
              <label key={r.user_id} className="flex min-h-11 items-center gap-2.5 text-sm font-medium">
                <input type="checkbox" name="offer" value={r.user_id} className="size-4 accent-ink" />
                {r.full_name}
              </label>
            ))}
        </fieldset>
        <fieldset className="rounded-panel bg-paper p-4">
          <legend className="px-1 text-sm font-semibold">
            You receive ({toTeam?.name ?? "—"})
          </legend>
          {(toTeam?.roster ?? [])
            .filter((r) => !r.is_captain)
            .map((r) => (
              <label key={r.user_id} className="flex min-h-11 items-center gap-2.5 text-sm font-medium">
                <input type="checkbox" name="request" value={r.user_id} className="size-4 accent-ink" />
                {r.full_name}
              </label>
            ))}
        </fieldset>
      </div>

      <Field label="Note (optional)" htmlFor="tr-note">
        <textarea
          id="tr-note"
          name="note"
          rows={2}
          placeholder="Why this works for both sides…"
          className="w-full rounded-control border border-rule bg-paper px-4 py-3 text-[17px] placeholder:text-ink-faint focus:border-ink/30 focus:outline-none"
        />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "Proposing…" : "Propose trade"}
      </Button>
    </form>
  );
}
