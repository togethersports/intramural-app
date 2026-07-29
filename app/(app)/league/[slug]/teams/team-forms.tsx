"use client";

import { useActionState } from "react";
import { createTeam, type ActionState } from "../actions";
import { Button, Field, FormError, Input, Select } from "@/components/ui";

const initial: ActionState = { error: null };

export function CreateTeamForm({
  slug,
  leagueId,
  seasonId,
  candidates,
}: {
  slug: string;
  leagueId: string;
  seasonId: string;
  candidates: { user_id: string; full_name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createTeam, initial);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <FormError message={state.error} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="league_id" value={leagueId} />
      <input type="hidden" name="season_id" value={seasonId} />
      <Field label="Team name" htmlFor="t-name">
        <Input id="t-name" name="name" placeholder="Warriors" required className="w-44" />
      </Field>
      <Field label="Abbrev" htmlFor="t-abbrev">
        <Input id="t-abbrev" name="abbrev" placeholder="WAR" maxLength={4} className="w-24" />
      </Field>
      <Field label="Color" htmlFor="t-color">
        <Input id="t-color" name="color" type="color" defaultValue="#54749b" className="h-11 w-16 p-1.5" />
      </Field>
      <Field label="Captain" htmlFor="t-captain">
        <Select id="t-captain" name="captain_id" defaultValue="" className="w-48">
          <option value="">Pick later</option>
          {candidates.map((c) => (
            <option key={c.user_id} value={c.user_id}>
              {c.full_name}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" disabled={pending} variant="quiet">
        {pending ? "Creating…" : "Add team"}
      </Button>
    </form>
  );
}
