"use client";

/**
 * Remove a visiting team from the Visiting teams list. The server refuses
 * while the team still has games, and that refusal shows here, under the
 * row, naming the fix.
 */
import { useActionState } from "react";
import { removeExternalTeam, type ActionState } from "../actions";
import { FormError } from "@/components/ui";

const initial: ActionState = { error: null };

export function RemoveVisitorButton({
  teamId,
  teamName,
  slug,
}: {
  teamId: string;
  teamName: string;
  slug: string;
}) {
  const [state, formAction, pending] = useActionState(removeExternalTeam, initial);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`Remove ${teamName}? This can't be undone.`)) e.preventDefault();
      }}
      className="contents"
    >
      <input type="hidden" name="team_id" value={teamId} />
      <input type="hidden" name="slug" value={slug} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-accent-ink transition-colors hover:bg-tint disabled:opacity-50"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {state.error ? (
        <div className="basis-full">
          <FormError message={state.error} />
        </div>
      ) : null}
    </form>
  );
}
