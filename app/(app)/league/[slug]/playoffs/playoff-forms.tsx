"use client";

import { useActionState } from "react";
import { generateBracketAction, type ActionState } from "../actions";
import { Button, Field, FormError, Select } from "@/components/ui";

const initial: ActionState = { error: null };

export function GenerateBracketForm({
  slug,
  seasonId,
  maxTeams,
}: {
  slug: string;
  seasonId: string;
  maxTeams: number;
}) {
  const [state, formAction, pending] = useActionState(
    generateBracketAction,
    initial,
  );
  const options = [2, 4, 6, 8, 12, 16].filter((n) => n <= maxTeams);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <FormError message={state.error} />
      {state.notice ? (
        <p className="w-full rounded-control bg-ink px-4 py-2.5 text-sm font-medium text-white">
          {state.notice}
        </p>
      ) : null}
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="season_id" value={seasonId} />
      <Field label="Playoff teams" htmlFor="pb-teams" hint="Seeded from final standings with tiebreakers.">
        <Select id="pb-teams" name="num_teams" defaultValue={String(Math.min(4, maxTeams))} className="w-36">
          {options.map((n) => (
            <option key={n} value={n}>
              Top {n}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" disabled={pending} variant="accent">
        {pending ? "Seeding…" : "Generate bracket"}
      </Button>
    </form>
  );
}
