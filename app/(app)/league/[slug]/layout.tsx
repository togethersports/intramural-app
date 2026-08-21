import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { resetDemoLeague } from "@/app/(app)/actions";
import { IconPlus } from "@/components/icons";
import { MODE_COOKIE, Shell } from "@/components/shell/shell";
import { TabTransition } from "@/components/tab-transition";
import { ThemeStyle } from "@/components/theme-style";
import { Button, ButtonLink } from "@/components/ui";
import { getMyProfile } from "@/lib/auth";
import {
  getActiveSeason,
  getLeague,
  getOpenTradeCount,
  getUnreadCount,
} from "@/lib/data";
import { leagueNav } from "@/lib/nav";
import { isLeagueAdmin, sportLabel } from "@core/league-constants";
import { DEFAULT_APPEARANCE, parseAppearance } from "@core/theme";

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

  const admin = isLeagueAdmin(league.role);
  const commissioner = league.role === "commissioner";
  // The trade count needs the season, so it cannot start until that answers —
  // but it does not need the profile or the unread count. Chaining it inside
  // the Promise.all overlaps it with those instead of waiting for all three.
  const [[season, openTrades], profile, unread, jar] = await Promise.all([
    getActiveSeason(league.id).then(
      async (s) => [s, s ? await getOpenTradeCount(s.id) : 0] as const,
    ),
    getMyProfile(),
    getUnreadCount(),
    cookies(),
  ]);

  // A league sets the palette everyone sees; a person may override it for
  // themselves from /profile. Personal wins, league is the fallback, and the
  // shipped default backs them both.
  const leagueAppearance = parseAppearance(
    league.settings?.appearance,
    DEFAULT_APPEARANCE,
  );
  const appearance = parseAppearance(profile?.appearance, leagueAppearance);
  const mode =
    admin && jar.get(MODE_COOKIE)?.value === "commish" ? "commish" : "player";

  return (
    <>
      <ThemeStyle appearance={appearance} />
      <Shell
        identity={{
          href: `/league/${league.slug}`,
          name: league.name,
          eyebrow: season?.name ?? sportLabel(league.sport),
          logoUrl: league.logo_url,
          color: league.primary_color,
        }}
        nav={{
          player: leagueNav(slug, { admin, commissioner, mode: "player" }),
          commish: admin
            ? leagueNav(slug, { admin, commissioner, mode: "commish" })
            : null,
        }}
        badges={{ inbox: unread, trades: openTrades }}
        user={{
          name: profile?.full_name ?? "Player",
          avatarUrl: profile?.avatar_url ?? null,
          roleLine: `${league.role} · ${league.name}`,
        }}
        initialMode={mode}
        screen={{
          kind: "league",
          ctx: {
            slug,
            leagueName: league.name,
            seasonName: season?.name ?? null,
            admin,
          },
        }}
        action={
          admin && season ? (
            <ButtonLink
              href={`/league/${league.slug}/game/new`}
              variant="accent"
              className="!min-h-11 !px-5 !py-2.5 !text-[15px]"
            >
              <IconPlus size={16} /> New game
            </ButtonLink>
          ) : null
        }
        banner={
          league.is_demo ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-panel bg-tint px-4 py-3">
              <p className="label !text-[11px] !text-accent-ink">
                Demo league — nothing here is real, explore freely.
              </p>
              {admin ? (
                <form action={resetDemoLeague}>
                  <input type="hidden" name="league_id" value={league.id} />
                  <Button
                    type="submit"
                    variant="quiet"
                    className="!min-h-9 !px-4 !py-2 !text-[13px]"
                  >
                    Reset demo league
                  </Button>
                </form>
              ) : null}
            </div>
          ) : null
        }
      >
        <TabTransition>{children}</TabTransition>
      </Shell>
    </>
  );
}
