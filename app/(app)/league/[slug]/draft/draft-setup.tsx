"use client";

import { useActionState } from "react";
import { createDraft, type ActionState } from "../actions";
import { Button, Field, FormError, Input, Select } from "@/components/ui";

const initial: ActionState = { error: null };

export function DraftSetupForm({
  slug,
  seasonId,
  teamCount,
  eligibleCount,
}: {
  slug: string;
  seasonId: string;
  teamCount: number;
  eligibleCount: number;
}) {
  const [state, formAction, pending] = useActionState(createDraft, initial);
  const suggestedRounds = teamCount > 0 ? Math.max(1, Math.floor(eligibleCount / teamCount)) : 5;

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.error} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="season_id" value={seasonId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Format" htmlFor="d-format">
          <Select id="d-format" name="format" defaultValue="snake">
            <option value="snake">Snake</option>
            <option value="linear">Linear</option>
          </Select>
        </Field>
        <Field label="Pick timer (seconds)" htmlFor="d-secs">
          <Input id="d-secs" name="pick_seconds" type="number" min={10} max={600} defaultValue={60} />
        </Field>
        <Field
          label="Rounds"
          htmlFor="d-rounds"
          hint={`${eligibleCount} eligible players ÷ ${teamCount} teams ≈ ${suggestedRounds}`}
        >
          <Input id="d-rounds" name="rounds" type="number" min={1} max={20} defaultValue={suggestedRounds} />
        </Field>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create draft"}
      </Button>
    </form>
  );
}
