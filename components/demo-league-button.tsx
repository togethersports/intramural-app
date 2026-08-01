"use client";

import { useActionState } from "react";
import { loadDemoLeague, type ActionState } from "@/app/(app)/actions";
import { Button, FormError } from "@/components/ui";

const initial: ActionState = { error: null };

/** Drops a fully populated 8-team league in one click — used on the two
    places a commissioner meets an empty product: the create-league form
    and the dashboard's empty state. */
export function DemoLeagueButton({ className }: { className?: string }) {
  const [state, formAction, pending] = useActionState(loadDemoLeague, initial);

  return (
    <form action={formAction} className={className}>
      <FormError message={state.error} />
      <Button type="submit" variant="quiet" disabled={pending} className="w-full">
        {pending ? "Building your demo league…" : "Load a demo league instead"}
      </Button>
      <p className="mt-2 text-center text-xs text-ink-faint">
        8 teams, 60 players, a played season and a live playoff game —
        reset it any time.
      </p>
    </form>
  );
}
