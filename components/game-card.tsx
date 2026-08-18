import Link from "next/link";
import { TeamBadge } from "@/components/ui";
import type { GameRow } from "@core/types";

/**
 * One game, everywhere it appears (league overview, schedule).
 *
 * Three bands, each with one job: when + state on top, the matchup in the
 * middle at reading weight, where it's played underneath. The old single
 * meta line crammed date, slot and venue into one truncating row, which
 * cut every real slot name in half ("PERIOD 4 LUN…") — the parts now sit
 * on their own line and wrap instead.
 */
function TeamLine({
  name,
  abbrev,
  color,
  score,
  showScore,
  won,
  decided,
}: {
  name: string;
  abbrev: string;
  color: string;
  score: number;
  showScore: boolean;
  won: boolean;
  decided: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <TeamBadge abbrev={abbrev} color={color} size={26} />
      <span
        className={`min-w-0 flex-1 truncate text-[16px] tracking-[-0.01em] ${
          decided && !won ? "font-medium text-ink-muted" : "font-semibold"
        }`}
      >
        {name}
      </span>
      {showScore ? (
        <span
          className={`num text-[19px] leading-none ${
            decided && !won ? "text-ink-muted" : ""
          }`}
        >
          {score}
        </span>
      ) : null}
    </div>
  );
}

export function GameCard({ game, slug }: { game: GameRow; slug: string }) {
  const showScore = game.status !== "scheduled" && game.status !== "postponed";
  const final = game.status === "final" || game.status === "forfeit";
  const decided = final && game.home_score !== game.away_score;
  const dateStr = game.scheduled_date
    ? new Date(`${game.scheduled_date}T00:00:00`).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "Date TBD";

  // Sentence case, not the shouty mono label — these are real place names
  // and they need the room to be read.
  const where = [
    game.time_slot?.label,
    game.venue?.name,
    game.is_adhoc ? "Pickup" : null,
    !game.counts_for_standings && game.status !== "abandoned"
      ? "Exhibition"
      : null,
  ].filter(Boolean);

  return (
    <Link
      href={`/league/${slug}/game/${game.id}`}
      className="row db-lift block p-4 hover:bg-surface"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="label !text-[11px]">{dateStr}</span>
        {game.status === "live" ? (
          <span className="label inline-flex shrink-0 items-center gap-1.5 !text-[11px] !text-accent">
            <span className="relative flex size-2">
              <span className="absolute h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative size-2 rounded-full bg-accent" />
            </span>
            Live
          </span>
        ) : final ? (
          <span className="label shrink-0 !text-[11px] !text-ink">
            {game.status === "forfeit" ? "Forfeit" : "Final"}
          </span>
        ) : game.status === "postponed" ? (
          <span className="label shrink-0 !text-[11px] !text-accent">
            Postponed
          </span>
        ) : game.status === "abandoned" ? (
          <span className="label shrink-0 !text-[11px] !text-ink-muted">
            Incomplete
          </span>
        ) : game.is_playoff ? (
          <span className="label shrink-0 !text-[11px] !text-bench">Playoff</span>
        ) : null}
      </div>

      <div className="mt-3 space-y-2">
        <TeamLine
          name={game.home_team?.name ?? "TBD"}
          abbrev={game.home_team?.abbrev ?? "?"}
          color={game.home_team?.color ?? "#54749b"}
          score={game.home_score}
          showScore={showScore}
          won={game.home_score > game.away_score}
          decided={decided}
        />
        <TeamLine
          name={game.away_team?.name ?? "TBD"}
          abbrev={game.away_team?.abbrev ?? "?"}
          color={game.away_team?.color ?? "#54749b"}
          score={game.away_score}
          showScore={showScore}
          won={game.away_score > game.home_score}
          decided={decided}
        />
      </div>

      {where.length > 0 ? (
        <p className="mt-3 border-t border-rule pt-2.5 text-[12.5px] leading-snug text-ink-muted">
          {where.join(" · ")}
        </p>
      ) : null}
    </Link>
  );
}
