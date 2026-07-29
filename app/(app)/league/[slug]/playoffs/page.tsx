import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconTrophy } from "@/components/icons";
import { EmptyState } from "@/components/ui";
import {
  getActiveSeason,
  getBracketNodes,
  getGames,
  getLeague,
  getTeams,
} from "@/lib/data";
import { roundName } from "@/packages/core/bracket";
import { isLeagueAdmin } from "@/packages/core/league-constants";
import type { BracketNodeRow, GameRow, TeamRow } from "@/packages/core/types";
import { GenerateBracketForm } from "./playoff-forms";

export const metadata: Metadata = { title: "Playoffs" };

function NodeCard({
  node,
  seeds,
  teams,
  games,
  nodesById,
  slug,
}: {
  node: BracketNodeRow;
  seeds: string[];
  teams: Map<string, TeamRow>;
  games: Map<string, GameRow>;
  nodesById: Map<string, BracketNodeRow>;
  slug: string;
}) {
  const resolve = (src: string): { teamId: string | null; label: string } => {
    if (src === "bye") return { teamId: null, label: "Bye" };
    if (src.startsWith("seed:")) {
      const n = parseInt(src.slice(5), 10);
      const teamId = seeds[n - 1] ?? null;
      return {
        teamId,
        label: teamId ? `(${n}) ${teams.get(teamId)?.name ?? "?"}` : `Seed ${n}`,
      };
    }
    if (src.startsWith("winner:")) {
      const prev = nodesById.get(src.slice(7));
      const teamId = prev?.winner_team_id ?? null;
      return {
        teamId,
        label: teamId ? (teams.get(teamId)?.name ?? "?") : "Winner TBD",
      };
    }
    return { teamId: null, label: "TBD" };
  };

  const home = resolve(node.home_source);
  const away = resolve(node.away_source);
  const game = node.game_id ? games.get(node.game_id) : undefined;

  const line = (side: { teamId: string | null; label: string }, score?: number) => {
    const winner = node.winner_team_id && side.teamId === node.winner_team_id;
    return (
      <div
        className={`flex items-center justify-between gap-2 rounded-control px-3 py-2 text-sm ${
          winner ? "bg-ink text-surface font-bold" : "bg-paper font-medium"
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {side.teamId ? (
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: teams.get(side.teamId)?.color ?? "#54749b" }}
            />
          ) : null}
          <span className="truncate">{side.label}</span>
        </span>
        {score !== undefined ? <span className="tabular">{score}</span> : null}
      </div>
    );
  };

  const inner = (
    <div className="w-52 shrink-0 space-y-1.5 rounded-panel bg-paper p-2.5 sm:w-56">
      {line(home, game && game.status !== "scheduled" ? game.home_score : undefined)}
      {line(away, game && game.status !== "scheduled" ? game.away_score : undefined)}
      {game ? (
        <p className="px-1 text-[11px] font-medium text-ink-faint">
          {game.status === "final"
            ? "Final"
            : game.status === "live"
              ? "Live now"
              : game.scheduled_date
                ? new Date(`${game.scheduled_date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : "Not yet scheduled"}
        </p>
      ) : null}
    </div>
  );

  return game ? (
    <Link href={`/league/${slug}/game/${game.id}`} className="block transition-transform hover:scale-[1.02]">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export default async function PlayoffsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeague(slug);
  if (!league) notFound();
  const admin = isLeagueAdmin(league.role);
  const season = await getActiveSeason(league.id);

  if (!season) {
    return (
      <div className="card p-6">
        <EmptyState icon={<IconTrophy size={26} />} title="No season yet" />
      </div>
    );
  }

  const [nodes, teamList, games] = await Promise.all([
    getBracketNodes(season.id),
    getTeams(season.id),
    getGames(season.id),
  ]);
  const teams = new Map(teamList.map((t) => [t.id, t]));
  const gameById = new Map(games.map((g) => [g.id, g]));
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const seeds = (season.playoff_format as { seeds?: string[] })?.seeds ?? [];

  if (nodes.length === 0) {
    return (
      <div className="card space-y-4 p-6">
        <EmptyState
          icon={<IconTrophy size={26} />}
          title="Playoffs haven't started"
          body={
            admin
              ? "Generate the bracket when the regular season wraps — seeding comes from the standings."
              : "The bracket appears when the commissioner starts the playoffs."
          }
        />
        {admin && teamList.length >= 2 ? (
          <GenerateBracketForm
            slug={slug}
            seasonId={season.id}
            maxTeams={teamList.length}
          />
        ) : null}
      </div>
    );
  }

  const rounds = [...new Set(nodes.map((n) => n.round))].sort((a, b) => a - b);
  const maxRound = rounds[rounds.length - 1];
  const champion =
    nodes.find((n) => n.round === maxRound)?.winner_team_id ?? null;

  return (
    <div className="space-y-5">
      {champion ? (
        <section className="card flex items-center justify-center gap-4 bg-ink p-8 text-center">
          <IconTrophy size={40} className="text-accent" />
          <div>
            <p className="text-sm font-medium text-surface/60">Champions</p>
            <p className="text-3xl font-semibold tracking-tight text-surface">
              {teams.get(champion)?.name ?? "?"}
            </p>
          </div>
        </section>
      ) : null}

      <section className="card p-5 sm:p-6">
        <h2 className="mb-5 text-lg font-semibold tracking-tight">Bracket</h2>
        <div className="scroll-x -mx-1 flex gap-8 px-1 pb-2">
          {rounds.map((round) => (
            <div key={round} className="flex flex-col gap-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink-faint">
                {roundName(round, maxRound)}
              </h3>
              <div className="flex flex-1 flex-col justify-around gap-4">
                {nodes
                  .filter((n) => n.round === round)
                  .map((node) => (
                    <NodeCard
                      key={node.id}
                      node={node}
                      seeds={seeds}
                      teams={teams}
                      games={gameById}
                      nodesById={nodesById}
                      slug={slug}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-faint">
          Winners advance automatically when playoff games go final. Playoff
          games are scheduled from the Schedule tab like any other game.
        </p>
      </section>
    </div>
  );
}
