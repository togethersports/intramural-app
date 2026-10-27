"use client";

/**
 * The commissioner's "write it again" for a game recap.
 *
 * A recap is written once, when the game finalizes, from the names and
 * numbers as they stood then. Rename a team, fix a stat, or set the API key
 * afterwards, and the stored recap is out of date until someone asks for a
 * new one — this is that ask. What happened comes back as a line under the
 * button, including why Claude didn't write it when it didn't.
 */
import { useActionState } from "react";
import { rewriteRecap, type ActionState } from "@/app/(app)/league/[slug]/actions";
import { Button, FormError, FormNotice } from "@/components/ui";

const initial: ActionState = { error: null, notice: null };

export function RewriteRecapButton({
  gameId,
  slug,
  label = "Rewrite recap",
}: {
  gameId: string;
  slug: string;
  label?: string;
}) {
  const [state, formAction, pending] = useActionState(rewriteRecap, initial);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="game_id" value={gameId} />
      <input type="hidden" name="slug" value={slug} />
      <Button type="submit" variant="quiet" disabled={pending}>
        {pending ? "Writing…" : label}
      </Button>
      <FormError message={state.error} />
      <FormNotice message={state.notice} />
    </form>
  );
}
