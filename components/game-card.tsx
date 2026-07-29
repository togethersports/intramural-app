import Link from "next/link";
import { TeamBadge } from "@/components/ui";
import type { GameRow } from "@core/types";

function TeamLine({
  name,
  abbrev,
  color,
  score,
  showScore,
  won,
}: {
  name: string;
  abbrev: string;
  color: string;
  score: number;
  showScore: boolean;
  won: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <TeamBadge abbrev={abbrev} color={color} size={28} />
      <span
        className={`min-w-0 flex-1 truncate text-[17px] ${won ? "font-semibold" : "font-medium"}`}
      >
        {name}
      </span>
      {showScore ? (
        <span className={`num text-[19px] ${won ? "" : "text-ink-muted"}`}>{score}</span>
      ) : null}
    </div>
  );
}

export function GameCard({ game, slug }: { game: GameRow; slug: string }) {
  const showScore = game.status !== "scheduled" && game.status !== "postponed";
  const final = game.status === "final" || game.status === "forfeit";
  const dateStr = game.scheduled_date
    ? new Date(`${game.scheduled_date}T00:00:00`).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "TBD";

  return (
    <Link
      href={`/league/${slug}/game/${game.id}`}
      className="row block p-4 transition-colors hover:bg-surface"
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="label truncate">
          {dateStr}
          {game.time_slot?.label ? ` · ${game.time_slot.label}` : ""}
          {game.venue?.name ? ` · ${game.venue.name}` : ""}
        </span>
        {game.status === "live" ? (
          <span className="label inline-flex items-center gap-1.5 !text-accent">
            <span className="relative flex size-2">
              <span className="absolute h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative size-2 rounded-full bg-accent" />
            </span>
            LIVE
          </span>
        ) : final ? (
          <span className="label !text-ink">
            {game.status === "forfeit" ? "Forfeit" : "Final"}
          </span>
        ) : game.status === "postponed" ? (
          <span className="label !text-accent">Postponed</span>
        ) : game.is_playoff ? (
          <span className="label !text-bench">Playoff</span>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <TeamLine
          name={game.home_team?.name ?? "TBD"}
          abbrev={game.home_team?.abbrev ?? "?"}
          color={game.home_team?.color ?? "#54749b"}
          score={game.home_score}
          showScore={showScore}
          won={final && game.home_score > game.away_score}
        />
        <TeamLine
          name={game.away_team?.name ?? "TBD"}
          abbrev={game.away_team?.abbrev ?? "?"}
          color={game.away_team?.color ?? "#54749b"}
          score={game.away_score}
          showScore={showScore}
          won={final && game.away_score > game.home_score}
        />
      </div>
    </Link>
  );
}
