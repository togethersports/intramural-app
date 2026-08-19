"use client";

import { useState } from "react";
import { Button, Field, Input, Panel } from "@/components/ui";
import { setPlayerStatus, setSubAvailability } from "../actions";

/**
 * The two things a player says about themselves that a captain needs.
 *
 * They are deliberately separate questions. "Am I injured" is about whether
 * this person can play at all; "will I sub" is about whether they want the
 * call when somebody else's team is short. A player can be perfectly fit and
 * not want to sub, or keen to sub and out for three weeks — collapsing them
 * into one control loses both answers.
 */
export function MyAvailability({
  slug,
  leagueId,
  status,
  statusNote,
  statusUntil,
  subAvailable,
  subNote,
}: {
  slug: string;
  leagueId: string;
  status: "available" | "injured" | "away";
  statusNote: string;
  statusUntil: string;
  subAvailable: boolean;
  subNote: string;
}) {
  const [chosen, setChosen] = useState(status);
  const [available, setAvailable] = useState(subAvailable);

  return (
    <Panel eyebrow="You" title="Your availability">
      <form action={setPlayerStatus} className="space-y-4">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="league_id" value={leagueId} />

        <div>
          <p className="label mb-2 !text-[11px]">Can you play right now?</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["available", "I'm good"],
                ["injured", "Injured"],
                ["away", "Away"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={
                  chosen === value
                    ? "inline-flex min-h-11 cursor-pointer items-center rounded-full border border-accent bg-tint px-5 text-[15px] font-semibold text-accent-ink"
                    : "inline-flex min-h-11 cursor-pointer items-center rounded-full border border-rule bg-paper px-5 text-[15px] font-medium transition-colors hover:border-ink-faint"
                }
              >
                <input
                  type="radio"
                  name="player_status"
                  value={value}
                  checked={chosen === value}
                  onChange={() => setChosen(value)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {chosen !== "available" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Anything your captain should know"
              htmlFor="status_note"
              hint="They see this on the roster."
            >
              <Input
                id="status_note"
                name="status_note"
                defaultValue={statusNote}
                maxLength={140}
                placeholder="Sprained ankle — cleared to shoot, not to play"
              />
            </Field>
            <Field label="Back by" htmlFor="status_until" hint="Optional.">
              <Input
                id="status_until"
                name="status_until"
                type="date"
                defaultValue={statusUntil}
              />
            </Field>
          </div>
        ) : null}

        <Button type="submit" variant="quiet" className="!min-h-11 !px-5 !text-[15px]">
          Save status
        </Button>
      </form>

      <form
        action={setSubAvailability}
        className="mt-5 space-y-3 border-t border-rule pt-5"
      >
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="league_id" value={leagueId} />
        <input type="hidden" name="available" value={available ? "1" : "0"} />

        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={available}
            onChange={(e) => setAvailable(e.target.checked)}
            className="size-5 shrink-0 accent-[var(--color-accent)]"
          />
          <span className="text-[15px] font-semibold">
            I&apos;ll sub for any team that&apos;s short
          </span>
        </label>
        {available ? (
          <Input
            name="note"
            defaultValue={subNote}
            maxLength={140}
            placeholder="When you can play, or how to reach you"
            aria-label="Note for captains"
          />
        ) : null}
        <Button type="submit" variant="quiet" className="!min-h-11 !px-5 !text-[15px]">
          {available ? "Put me on the list" : "Take me off the list"}
        </Button>
      </form>
    </Panel>
  );
}

/** What a captain sees about somebody who isn't fit. */
export function StatusChip({
  status,
  note,
  until,
}: {
  status: string;
  note: string | null;
  until: string | null;
}) {
  if (status === "available") return null;
  const label = status === "injured" ? "Injured" : "Away";
  const detail = [note, until ? `back ${until}` : null].filter(Boolean).join(" · ");
  return (
    <span
      title={detail || label}
      className="label inline-flex items-center rounded-full bg-tint px-2.5 py-1 !text-[10px] !text-accent-ink"
    >
      {label}
    </span>
  );
}
