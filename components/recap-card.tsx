import Link from "next/link";
import { Avatar, Panel } from "@/components/ui";
import type { GameRecapRow, WeeklyAwardRow } from "@/lib/data";

/**
 * The written recap of a finished game.
 *
 * The eyebrow says where the words came from. That is not a disclaimer for
 * its own sake — a league that hasn't configured a model gets prose
 * assembled from the box score, and somebody reading a flat recap should be
 * able to tell which of the two they are looking at.
 */
export function RecapCard({ recap }: { recap: GameRecapRow }) {
  return (
    <Panel
      eyebrow={recap.source === "claude" ? "Recap · written by Claude" : "Recap"}
      title={recap.headline || "How it went"}
    >
      <p className="max-w-[68ch] text-[17px] leading-[1.6] text-ink-body">
        {recap.body}
      </p>
    </Panel>
  );
}

/** The stats worth putting on the card, in the order people say them. */
const AWARD_STATS: { key: string; label: string }[] = [
  { key: "pts", label: "PTS" },
  { key: "reb", label: "REB" },
  { key: "ast", label: "AST" },
  { key: "stl", label: "STL" },
  { key: "blk", label: "BLK" },
];

export function PlayerOfWeekCard({
  award,
  slug,
}: {
  award: WeeklyAwardRow;
  slug: string;
}) {
  const shown = AWARD_STATS.filter((s) => (award.stat_line[s.key] ?? 0) > 0);

  return (
    <Panel eyebrow={`Week ${award.week}`} title="Player of the week">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={award.full_name} size={56} />
        <div className="min-w-0 flex-1">
          {award.user_id ? (
            <Link
              href={`/league/${slug}/player/${award.user_id}`}
              className="truncate text-[19px] font-semibold hover:underline"
            >
              {award.full_name}
            </Link>
          ) : (
            <p className="truncate text-[19px] font-semibold">{award.full_name}</p>
          )}
          <p className="text-[14px] text-ink-body">{award.team_name}</p>
        </div>
      </div>

      {shown.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-rule pt-4">
          {shown.map((s) => (
            <div key={s.key}>
              <p className="num text-[24px] leading-none">
                {award.stat_line[s.key]}
              </p>
              <p className="label mt-1 !text-[10px]">{s.label}</p>
            </div>
          ))}
          {award.stat_line.games ? (
            <div>
              <p className="num text-[24px] leading-none">{award.stat_line.games}</p>
              <p className="label mt-1 !text-[10px]">
                {award.stat_line.games === 1 ? "Game" : "Games"}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {award.blurb ? (
        <p className="mt-4 max-w-[62ch] text-[15px] leading-[1.6] text-ink-body">
          {award.blurb}
        </p>
      ) : null}
    </Panel>
  );
}
