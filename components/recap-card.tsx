import Link from "next/link";
import { Avatar, Panel } from "@/components/ui";
import { RewriteRecapButton } from "@/components/rewrite-recap-button";
import type { GameRecapRow, WeeklyAwardRow } from "@/lib/data";

/**
 * The written recap of a finished game.
 *
 * The line under it says where the words came from. That is not a
 * disclaimer for its own sake — a league that hasn't configured a model gets
 * prose assembled from the box score, and somebody reading a flat recap
 * should be able to tell which of the two they are looking at. The
 * commissioner also gets the reason and a way to write it again.
 */
export function RecapCard({
  recap,
  admin,
}: {
  recap: GameRecapRow;
  /** Present for the commissioner: the rewrite control and the why. */
  admin?: { gameId: string; slug: string; aiConfigured: boolean };
}) {
  const byClaude = recap.source === "claude";
  return (
    <Panel title={recap.headline || "How it went"}>
      <p className="max-w-[68ch] text-[17px] leading-[1.6] text-ink-body">
        {recap.body}
      </p>
      {byClaude ? (
        <p className="mt-3 text-sm text-ink-faint">Written by Claude from the box score and play-by-play.</p>
      ) : admin ? (
        <p className="mt-3 max-w-[68ch] text-sm text-ink-muted">
          {admin.aiConfigured
            ? "Written from the box score — Claude couldn't be reached when this game finished. Rewrite it to try again."
            : "Written from the box score, because ANTHROPIC_API_KEY isn't set on the server. Add it in Vercel, redeploy, then rewrite this."}
        </p>
      ) : null}
      {admin ? (
        <div className="mt-4">
          <RewriteRecapButton gameId={admin.gameId} slug={admin.slug} />
        </div>
      ) : null}
    </Panel>
  );
}

/** A finished game with no recap yet — for the commissioner only. */
export function MissingRecapCard({ gameId, slug }: { gameId: string; slug: string }) {
  return (
    <Panel title="No recap yet">
      <p className="mb-4 max-w-[68ch] text-[15px] text-ink-body">
        This game finished without a recap being written. Write one now from its box score.
      </p>
      <RewriteRecapButton gameId={gameId} slug={slug} label="Write recap" />
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
