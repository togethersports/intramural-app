"use client";

import { useActionState, useState } from "react";
import { generateBracketAction, resetBracketAction, type ActionState } from "../actions";
import { maxPlayIn, playInMatchups } from "@core/bracket";
import { Button, Field, FormError, FormNotice, Select } from "@/components/ui";

const initial: ActionState = { error: null };

/** "4 v 5", "3 v 6 and 4 v 5" — the play-in described by who plays. */
function describePlayIn(size: number, games: number): string {
  if (games === 0) return "No play-in";
  const pairs = playInMatchups(size, games)
    .reverse()
    .map(([hi, lo]) => `${hi} v ${lo}`);
  return pairs.length === 1 ? pairs[0] : `${pairs.slice(0, -1).join(", ")} and ${pairs[pairs.length - 1]}`;
}

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
  // Bracket sizes are powers of two; a field in between is a play-in, not a
  // bracket padded with byes.
  const sizes = [2, 4, 8, 16].filter((n) => n <= maxTeams);
  const [size, setSize] = useState(() => Math.max(...sizes.filter((n) => n <= 4)));
  const [playIn, setPlayIn] = useState(0);
  const most = maxPlayIn(size, maxTeams);
  const games = Math.min(playIn, most);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <FormError message={state.error} />
      <FormNotice message={state.notice} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="season_id" value={seasonId} />
      <Field label="Bracket" htmlFor="pb-teams" hint="Seeded from final standings with tiebreakers.">
        <Select
          id="pb-teams"
          name="num_teams"
          value={String(size)}
          onChange={(e) => setSize(Number(e.target.value))}
          className="w-36"
        >
          {sizes.map((n) => (
            <option key={n} value={n}>
              Top {n}
            </option>
          ))}
        </Select>
      </Field>
      {most > 0 ? (
        <Field
          label="Play-in"
          htmlFor="pb-playin"
          hint={
            games
              ? `Seeds ${describePlayIn(size, games)} play first; winners take those spots.`
              : `Seeds ${size + 1}${maxTeams > size + 1 ? ` and below` : ""} miss the playoffs.`
          }
        >
          <Select
            id="pb-playin"
            name="play_in"
            value={String(games)}
            onChange={(e) => setPlayIn(Number(e.target.value))}
            className="w-52"
          >
            {Array.from({ length: most + 1 }, (_, n) => (
              <option key={n} value={n}>
                {describePlayIn(size, n)}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <input type="hidden" name="play_in" value="0" />
      )}
      <Button type="submit" disabled={pending} variant="accent">
        {pending ? "Seeding…" : "Generate bracket"}
      </Button>
    </form>
  );
}

/** Take the bracket down before any playoff game starts. */
export function ResetBracketForm({ slug, seasonId }: { slug: string; seasonId: string }) {
  const [state, formAction, pending] = useActionState(resetBracketAction, initial);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        const ok = window.confirm(
          "Start the bracket over? Its playoff games are deleted and you build it again — with a play-in, a different size, or fresh seeding.",
        );
        if (!ok) e.preventDefault();
      }}
      className="space-y-3"
    >
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="season_id" value={seasonId} />
      <Button type="submit" variant="quiet" disabled={pending}>
        {pending ? "Clearing…" : "Start the bracket over"}
      </Button>
      <FormError message={state.error} />
      <FormNotice message={state.notice} />
    </form>
  );
}
