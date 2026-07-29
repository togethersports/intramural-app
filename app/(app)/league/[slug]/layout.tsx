import { notFound } from "next/navigation";
import { LeagueNav } from "@/components/league-nav";
import { getActiveSeason, getLeague } from "@/lib/data";
import { isLeagueAdmin, sportLabel } from "@/packages/core/league-constants";

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
