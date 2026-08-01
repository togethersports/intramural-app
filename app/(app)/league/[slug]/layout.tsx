import { notFound } from "next/navigation";
import { resetDemoLeague } from "@/app/(app)/actions";
import { LeagueNav } from "@/components/league-nav";
import { Button } from "@/components/ui";
import { getActiveSeason, getLeague } from "@/lib/data";
import { isLeagueAdmin, sportLabel } from "@core/league-constants";

export default async function LeagueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeague(slug);
  if (!league) notFound();
  const season = await getActiveSeason(league.id);

  return (
    <div className="space-y-4">
      {league.is_demo ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-panel bg-ink px-4 py-3 text-white">
          <p className="label !text-white">
            Demo league — nothing here is real, explore freely.
          </p>
          {isLeagueAdmin(league.role) ? (
            <form action={resetDemoLeague}>
              <input type="hidden" name="league_id" value={league.id} />
              <Button type="submit" variant="light" className="!min-h-9 !px-4 !py-2 !text-[13px]">
                Reset demo league
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}
      <header className="flex flex-wrap items-center justify-between gap-3 text-white">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid size-11 shrink-0 place-items-center rounded-[14px] text-lg font-bold text-white"
            style={{ backgroundColor: league.primary_color }}
          >
            {league.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <h1 className="text-2xl font-semibold leading-tight tracking-tight">
              {league.name}
            </h1>
            <p className="text-sm text-white/70">
              {sportLabel(league.sport)}
              {season ? ` · ${season.name}` : " · no season yet"}
            </p>
          </div>
        </div>
        {season ? (
          <span className="chip capitalize">{season.status}</span>
        ) : null}
      </header>
      <LeagueNav slug={league.slug} admin={isLeagueAdmin(league.role)} />
      {children}
    </div>
  );
}
