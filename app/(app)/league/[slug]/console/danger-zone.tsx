"use client";

import { useActionState, useState } from "react";
import {
  archiveLeague,
  deleteLeagueAction,
  type ActionState,
} from "@/app/(app)/actions";
import { Button, FormError, Input } from "@/components/ui";
import type { LeagueFootprint } from "@/lib/data";

const initial: ActionState = { error: null };

/** The destructive tail of the console — commissioner only. Archive is the
    gentle option; delete requires typing the league name and spells out
    exactly what goes, with live counts. */
export function DangerZone({
  leagueId,
  leagueName,
  counts,
}: {
  leagueId: string;
  leagueName: string;
  counts: LeagueFootprint;
}) {
  const [state, formAction, pending] = useActionState(deleteLeagueAction, initial);
  const [typed, setTyped] = useState("");
  const match = typed.trim() === leagueName;

  const scale = [
    [counts.teams, "teams"],
    [counts.members, "members"],
    [counts.games, "games"],
    [counts.statLines, "box score lines"],
    [counts.trades, "trades"],
    [counts.bracketNodes, "bracket slots"],
  ] as const;

  return (
    <section className="card border-2 border-accent/40 p-5 sm:p-6">
      <h2 className="mb-1 text-lg font-semibold tracking-tight">Danger zone</h2>
      <p className="mb-5 text-sm text-ink-body">
        These act on the whole league, not just a season.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-panel bg-paper p-4">
        <div>
          <p className="font-semibold">Archive this league</p>
          <p className="text-sm text-ink-body">
            Off your active list, everything kept. Bring it back any time from
            the dashboard.
          </p>
        </div>
        <form action={archiveLeague}>
          <input type="hidden" name="league_id" value={leagueId} />
          <Button type="submit" variant="quiet">
            Archive league
          </Button>
        </form>
      </div>

      <div className="mt-3 rounded-panel bg-tint p-4">
        <p className="font-semibold text-accent">Delete this league</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-body">
          Removes the league for every member: teams, rosters, the schedule,
          all games and box scores, standings, stats history, trades, and the
          bracket. You can restore it for 30 days from the dashboard&apos;s
          Archived section — after that it is purged for good.
        </p>
        <p className="num mt-2 text-[13px] text-ink-body">
          {scale
            .filter(([n]) => n > 0)
            .map(([n, what]) => `${n} ${what}`)
            .join(" · ") || "Nothing recorded yet"}
        </p>
        <form action={formAction} className="mt-4 space-y-3">
          <FormError message={state.error} />
          <input type="hidden" name="league_id" value={leagueId} />
          <label className="block">
            <span className="text-sm font-medium text-ink-body">
              Type <span className="font-semibold text-ink">{leagueName}</span>{" "}
              to confirm
            </span>
            <Input
              name="confirm_name"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={leagueName}
              autoComplete="off"
              className="mt-1.5"
            />
          </label>
          <Button
            type="submit"
            variant="accent"
            disabled={!match || pending}
          >
            {pending ? "Deleting…" : "Delete league"}
          </Button>
        </form>
      </div>
    </section>
  );
}
