"use client";

/**
 * The typed-name confirm before a permanent league delete. window.prompt is
 * browser-only, so this one form lives in a client component — rendering it
 * from the server dashboard crashed the whole page for anyone with an
 * archived league ("Event handlers cannot be passed to Client Component
 * props"). The dialog stays a courtesy; the commissioner-only guarantee is
 * still the RLS delete policy behind the server action.
 */
import { purgeLeague } from "@/app/(app)/actions";
import { Button } from "@/components/ui";

export function PurgeLeagueForm({
  leagueId,
  leagueName,
}: {
  leagueId: string;
  leagueName: string;
}) {
  return (
    <form
      action={purgeLeague}
      onSubmit={(e) => {
        const typed = window.prompt(
          `This deletes ${leagueName} and every season, game and stat in it, immediately and permanently. Type the league name to confirm:`,
        );
        if (typed !== leagueName) e.preventDefault();
      }}
    >
      <input type="hidden" name="league_id" value={leagueId} />
      <Button
        type="submit"
        variant="quiet"
        className="!min-h-10 !px-4 !py-2 !text-[14px] !text-caution"
      >
        Delete forever
      </Button>
    </form>
  );
}
