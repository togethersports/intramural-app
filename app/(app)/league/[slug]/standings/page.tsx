import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconTrophy } from "@/components/icons";
import { StandingsTable } from "@/components/standings-table";
import { EmptyState, Panel } from "@/components/ui";
import { getActiveSeason, getLeague, getSeasonStandings } from "@/lib/data";
import { DEFAULT_TIEBREAKERS, TIEBREAKER_LABELS } from "@core/standings";

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
  const { rows, explanations } = await getSeasonStandings(season.id);

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

      {explanations.length > 0 ? (
        <Panel eyebrow="Tiebreakers" title="Why this order?">
          <TiebreakNotes slug={slug} notes={explanations} rows={rows} />
        </Panel>
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
