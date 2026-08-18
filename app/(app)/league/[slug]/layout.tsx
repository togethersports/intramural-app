import { notFound } from "next/navigation";
import { resetDemoLeague } from "@/app/(app)/actions";
import { LeagueNav } from "@/components/league-nav";
import { TabTransition } from "@/components/tab-transition";
import { Button, ButtonLink } from "@/components/ui";
import { IconPlus } from "@/components/icons";
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
      {/* Identity block: the mono eyebrow carries sport and season so the
          league's own name gets the full display line to itself. */}
      <header className="flex flex-wrap items-end justify-between gap-4 px-1 text-white">
        <div className="flex min-w-0 items-center gap-3.5">
          <span
            aria-hidden
            className="grid size-12 shrink-0 place-items-center rounded-[15px] text-[21px] font-semibold text-white"
            style={{ backgroundColor: league.primary_color }}
          >
            {league.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="label !text-white/70">
              {sportLabel(league.sport)}
              {season ? ` · ${season.name}` : " · no season yet"}
            </p>
            <h1 className="mt-1 truncate text-[clamp(24px,3vw,34px)] font-semibold leading-[1.05] tracking-[-0.03em]">
              {league.name}
            </h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          {season ? (
            <span className="label rounded-full bg-white/22 px-4 py-2 !text-[11px] !text-white backdrop-blur-sm">
              {season.status}
            </span>
          ) : null}
          {/* An action, so it sits with the identity block rather than
              competing with the twelve destinations in the rail. */}
          {isLeagueAdmin(league.role) && season ? (
            <ButtonLink
              href={`/league/${league.slug}/game/new`}
              variant="light"
              className="!min-h-10 !px-5 !py-2.5 !text-[15px]"
            >
              <IconPlus size={16} /> New game
            </ButtonLink>
          ) : null}
        </div>
      </header>
      <LeagueNav slug={league.slug} admin={isLeagueAdmin(league.role)} />
      <TabTransition>{children}</TabTransition>
    </div>
  );
}
