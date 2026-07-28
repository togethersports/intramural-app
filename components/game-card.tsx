import Link from "next/link";
import type { GameRow } from "@/lib/types";

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
      <span
        aria-hidden
        className="grid size-7 shrink-0 place-items-center rounded-[8px] text-[10px] font-bold text-white"
        style={{ backgroundColor: color }}
      >
        {abbrev.slice(0, 3)}
      </span>
      <span className={`min-w-0 flex-1 truncate text-sm ${won ? "font-bold" : "font-medium"}`}>
        {name}
      </span>
      {showScore ? (
        <span className={`tabular text-base ${won ? "font-bold" : "font-medium text-ink-soft"}`}>
          {score}
        </span>
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
      className="block rounded-panel bg-surface-dim/60 p-4 transition-colors hover:bg-surface-dim"
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-xs font-medium text-ink-soft">
        <span className="truncate">
          {dateStr}
          {game.time_slot?.label ? ` · ${game.time_slot.label}` : ""}
          {game.venue?.name ? ` · ${game.venue.name}` : ""}
        </span>
        {game.status === "live" ? (
          <span className="inline-flex items-center gap-1.5 font-bold text-accent">
            <span className="relative flex size-2">
              <span className="absolute h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative size-2 rounded-full bg-accent" />
            </span>
            LIVE
          </span>
        ) : final ? (
          <span className="font-bold text-ink">
            {game.status === "forfeit" ? "FORFEIT" : "FINAL"}
          </span>
        ) : game.status === "postponed" ? (
          <span className="font-bold text-amber">PPD</span>
        ) : game.is_playoff ? (
          <span className="font-bold text-court">PLAYOFF</span>
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
