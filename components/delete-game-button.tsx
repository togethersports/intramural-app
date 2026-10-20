"use client";

/**
 * Delete a game — the one control both the schedule and the game page use.
 *
 * It exists because the two used to disagree, with each other and with the
 * server: the schedule offered Delete on every game with no confirmation,
 * the game page only on exhibitions, and the action quietly refused a live
 * official game and redirected as if it had worked. Now the pages decide
 * whether to render this from @core's deleteBlockedReason, the server checks
 * the same rule, and anything it still refuses comes back here as a message
 * instead of a reload that changes nothing.
 */
import { useActionState } from "react";
import { deleteGame, type DeleteGameState } from "@/app/(app)/league/[slug]/actions";
import { Button, FormError } from "@/components/ui";

const initial: DeleteGameState = { error: null };

export function DeleteGameButton({
  gameId,
  slug,
  played,
  label = "Delete",
  appearance = "inline",
}: {
  gameId: string;
  slug: string;
  /** Anything recorded? Changes what the confirmation warns about. */
  played: boolean;
  label?: string;
  /** "inline" sits in a dense row of admin controls; "button" is the quiet
      pill the game page's own controls use. */
  appearance?: "inline" | "button";
}) {
  const [state, formAction, pending] = useActionState(deleteGame, initial);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        const ok = window.confirm(
          played
            ? "Delete this game and everything recorded in it? The box score goes too, and this can't be undone."
            : "Delete this game? This can't be undone.",
        );
        if (!ok) e.preventDefault();
      }}
      className="contents"
    >
      <input type="hidden" name="game_id" value={gameId} />
      <input type="hidden" name="slug" value={slug} />
      {appearance === "button" ? (
        <Button type="submit" variant="quiet" disabled={pending} className="!text-accent-ink">
          {pending ? "Deleting…" : label}
        </Button>
      ) : (
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-control px-3 text-xs font-semibold text-accent-ink hover:bg-tint disabled:opacity-50"
        >
          {pending ? "Deleting…" : label}
        </button>
      )}
      {state.error ? (
        <div className="basis-full">
          <FormError message={state.error} />
        </div>
      ) : null}
    </form>
  );
}
