"use client";

import { useState } from "react";
import { Avatar, Button, Input, Panel } from "@/components/ui";
import { setSubAvailability } from "../actions";

export interface SubRow {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  grade: number | null;
  positions: string[];
  note: string | null;
}

/**
 * The sub pool: players who have said they will fill in for any team that
 * turns up short. Distinct from availability, which answers "which periods
 * am I free" — this answers "do you want the call at all", and captains read
 * it when a game is an hour away and they have four.
 */
export function SubPool({
  slug,
  leagueId,
  subs,
  me,
}: {
  slug: string;
  leagueId: string;
  subs: SubRow[];
  me: { available: boolean; note: string } | null;
}) {
  const [available, setAvailable] = useState(me?.available ?? false);

  return (
    <Panel
      eyebrow="Short a player?"
      title="Available subs"
      action={
        <span className="num text-[15px] text-ink-body">
          {subs.length} {subs.length === 1 ? "person" : "people"}
        </span>
      }
    >
      {me ? (
        <form
          action={setSubAvailability}
          className="mb-5 space-y-3 rounded-panel bg-paper p-4"
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
              defaultValue={me.note}
              maxLength={140}
              placeholder="When you can play, or how to reach you"
              aria-label="Note for captains"
            />
          ) : null}
          <Button
            type="submit"
            variant="quiet"
            className="!min-h-11 !px-4 !text-[15px]"
          >
            {available ? "Put me on the list" : "Take me off the list"}
          </Button>
        </form>
      ) : null}

      {subs.length === 0 ? (
        <p className="text-[15px] text-ink-body">
          Nobody has put their hand up yet. Anyone in the league can, from
          right here.
        </p>
      ) : (
        <ul className="space-y-2">
          {subs.map((s) => (
            <li
              key={s.user_id}
              className="flex flex-wrap items-center gap-3 rounded-panel bg-paper px-3 py-2.5"
            >
              <Avatar name={s.full_name} src={s.avatar_url} size={34} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {s.full_name}
                </span>
                <span className="block truncate text-[13px] text-ink-body">
                  {[
                    s.grade ? `Grade ${s.grade}` : null,
                    s.positions.length > 0 ? s.positions.join(" / ") : null,
                    s.note,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Anywhere you need"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
