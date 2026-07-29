"use client";

import { useActionState } from "react";
import { postAnnouncement, type ActionState } from "./actions";
import { Button, FormError } from "@/components/ui";

const initial: ActionState = { error: null };

export function FeedComposer({
  leagueId,
  seasonId,
  slug,
  captainTeam,
  admin,
}: {
  leagueId: string;
  seasonId: string | null;
  slug: string;
  captainTeam: { id: string; name: string } | null;
  admin: boolean;
}) {
  const [state, formAction, pending] = useActionState(postAnnouncement, initial);

  return (
    <form action={formAction} className="space-y-2">
      <FormError message={state.error} />
      <input type="hidden" name="league_id" value={leagueId} />
      <input type="hidden" name="season_id" value={seasonId ?? ""} />
      <input type="hidden" name="slug" value={slug} />
      <textarea
        name="body"
        rows={2}
        required
        placeholder={
          admin ? "Post an announcement to the league…" : "Post to your team…"
        }
        className="w-full rounded-control border border-rule bg-paper px-4 py-3 text-[15px] placeholder:text-ink-faint focus:border-ink/30 focus:outline-none focus:ring-2 focus:ring-ink/10"
      />
      <div className="flex items-center justify-between gap-3">
        {!admin && captainTeam ? (
          <input type="hidden" name="team_id" value={captainTeam.id} />
        ) : (
          <span />
        )}
        <Button type="submit" disabled={pending} variant="primary" className="px-4">
          {pending ? "Posting…" : "Post"}
        </Button>
      </div>
    </form>
  );
}
