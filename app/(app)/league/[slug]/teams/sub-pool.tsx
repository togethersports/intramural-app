"use client";

import { Avatar, Panel } from "@/components/ui";

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
export function SubPool({ subs }: { subs: SubRow[] }) {
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
      {subs.length === 0 ? (
        <p className="text-[15px] text-ink-body">
          Nobody has put their hand up yet. Anyone in the league can, from right
          here.
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
