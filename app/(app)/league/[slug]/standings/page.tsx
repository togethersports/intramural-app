import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconTrophy } from "@/components/icons";
import { StandingsTable } from "@/components/standings-table";
import { Button, EmptyState, Panel } from "@/components/ui";
import { getActiveSeason, getLeague, getSeasonStandings } from "@/lib/data";
import { isLeagueAdmin } from "@core/league-constants";
import {
  DEFAULT_TIEBREAKERS,
  TIEBREAKER_LABELS,
  oneOnOnesFrom,
  type OneOnOne,
} from "@core/standings";
import { recordOneOnOne } from "../actions";

export const metadata: Metadata = { title: "Standings" };

export default async function StandingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeague(slug);
  if (!league) notFound();
  const season = await getActiveSeason(league.id);
  if (!season) {
    return (
      <div className="card p-6">
        <EmptyState
          icon={<IconTrophy size={26} />}
          title="No season yet"
          body="Standings appear once games go final."
        />
      </div>
    );
  }
  const { rows, explanations, needsOneOnOne } = await getSeasonStandings(season.id);
  const admin = isLeagueAdmin(league.role);

  return (
    <div className="space-y-5">
      <Panel eyebrow={season.name} title="Standings">
        {rows.length === 0 ? (
          <EmptyState
            icon={<IconTrophy size={26} />}
            title="No teams yet"
            body="Standings light up after the draft."
          />
        ) : (
          <StandingsTable rows={rows} slug={slug} full />
        )}
        <p className="mt-4 border-t border-rule pt-3.5 text-[12.5px] text-ink-muted">
          Ties break in order:{" "}
          {DEFAULT_TIEBREAKERS.map((t) => TIEBREAKER_LABELS[t]).join(" → ")}.
        </p>
      </Panel>

      {needsOneOnOne.length > 0 || (admin && oneOnOnesFrom(season.rules).length > 0) ? (
        <Panel title="Captains' 1v1">
          <OneOnOnes
            slug={slug}
            seasonId={season.id}
            groups={needsOneOnOne}
            results={oneOnOnesFrom(season.rules)}
            rows={rows}
            admin={admin}
          />
        </Panel>
      ) : null}

      {explanations.length > 0 ? (
        <Panel eyebrow="Tiebreakers" title="Why this order?">
          <TiebreakNotes slug={slug} notes={explanations} rows={rows} />
        </Panel>
      ) : null}
    </div>
  );
}

/**
 * Ties the games can't break — same record, same head-to-head record, same
 * head-to-head point differential. The rule sends them to a captains' 1v1;
 * the commissioner records who won and the standings take it from there.
 */
function OneOnOnes({
  slug,
  seasonId,
  groups,
  results,
  rows,
  admin,
}: {
  slug: string;
  seasonId: string;
  groups: string[][];
  results: OneOnOne[];
  rows: { teamId: string; name: string }[];
  admin: boolean;
}) {
  const nameFor = (id: string) => rows.find((r) => r.teamId === id)?.name ?? "Unknown";
  const resultFor = (a: string, b: string) =>
    results.find((r) => (r.winner === a && r.loser === b) || (r.winner === b && r.loser === a));
  // Results already in, for teams not waiting on one — listed so a mistake
  // can be flipped after the tie it settled disappears from above.
  const settled = results.filter(
    (r) => !groups.some((g) => g.includes(r.winner) && g.includes(r.loser)),
  );
  const list = (ids: string[]) =>
    ids.length === 2
      ? `${nameFor(ids[0])} and ${nameFor(ids[1])}`
      : `${ids.slice(0, -1).map(nameFor).join(", ")} and ${nameFor(ids[ids.length - 1])}`;

  return (
    <div className="space-y-4">
      {groups.length > 0 ? (
        <p className="max-w-[62ch] text-[15px] text-ink-body">
          These teams are level on record, head-to-head record and head-to-head point
          differential, so their captains play 1v1.{" "}
          {admin
            ? "Record who won and the standings — and playoff seeding — follow."
            : "The commissioner records the result."}
        </p>
      ) : null}
      {groups.map((group) => {
        const pairs = group.flatMap((a, i) => group.slice(i + 1).map((b) => [a, b] as const));
        return (
          <div key={group.join()} className="space-y-2 rounded-panel bg-paper p-4">
            <p className="font-semibold">{list(group)}</p>
            {pairs.map(([a, b]) => {
              const done = resultFor(a, b);
              return (
                <div key={`${a}-${b}`} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 text-sm text-ink-body">
                    {done
                      ? `${nameFor(done.winner)} beat ${nameFor(done.loser)}`
                      : `${nameFor(a)} v ${nameFor(b)} — not played yet`}
                  </span>
                  {admin
                    ? [a, b].map((winner) => (
                        <form key={winner} action={recordOneOnOne}>
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="season_id" value={seasonId} />
                          <input type="hidden" name="winner" value={winner} />
                          <input type="hidden" name="loser" value={winner === a ? b : a} />
                          <Button
                            type="submit"
                            variant="quiet"
                            disabled={done?.winner === winner}
                            className="!min-h-11 !px-4 !text-[14px]"
                          >
                            {nameFor(winner)} won
                          </Button>
                        </form>
                      ))
                    : null}
                </div>
              );
            })}
          </div>
        );
      })}
      {admin && settled.length > 0 ? (
        <div className="space-y-2 border-t border-rule pt-4">
          <p className="label !text-[11px]">Recorded</p>
          {settled.map((r) => (
            <div key={`${r.winner}-${r.loser}`} className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 text-sm text-ink-body">
                {nameFor(r.winner)} beat {nameFor(r.loser)}
              </span>
              <form action={recordOneOnOne}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="season_id" value={seasonId} />
                <input type="hidden" name="winner" value={r.loser} />
                <input type="hidden" name="loser" value={r.winner} />
                <Button type="submit" variant="quiet" className="!min-h-11 !px-4 !text-[14px]">
                  Wrong way round — {nameFor(r.loser)} won
                </Button>
              </form>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TiebreakNotes({
  notes,
  rows,
}: {
  slug: string;
  notes: string[];
  rows: { teamId: string; name: string }[];
}) {
  const nameFor = (id: string) =>
    rows.find((r) => r.teamId === id)?.name ?? id.slice(0, 8);
  return (
    <ul className="space-y-1.5 text-sm text-ink-body">
      {notes.map((n, i) => {
        // notes reference team ids — swap in names
        let text = n;
        for (const r of rows) text = text.replaceAll(r.teamId, nameFor(r.teamId));
        return <li key={i}>• {text}</li>;
      })}
    </ul>
  );
}
