import type { Metadata } from "next";
import {
  DashboardView,
  type PendingAction,
} from "@/components/dashboard-view";
import { getMyName, requireUser } from "@/lib/auth";
import { getMyLastStatLine, getMyNextGame, getMyTeams } from "@/lib/data";
import { getMyLeagues, getShelvedLeagues } from "@/lib/leagues";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();
  // Everything the page needs, in ONE parallel round: the old shape ran the
  // purge, then the batch, then drafts, then availability — four serial
  // waits, and every one of them was a full network hop on a click.
  const [name, leagues, shelved, myTeams, nextGame, lastLine, liveDraftsRes] =
    await Promise.all([
      getMyName(),
      getMyLeagues(),
      getShelvedLeagues(),
      getMyTeams(user.id),
      getMyNextGame(user.id),
      getMyLastStatLine(user.id),
      supabase
        .from("drafts")
        .select("status, season:seasons(league:leagues(slug, name))")
        .eq("status", "live"),
      // opportunistic hard-purge of leagues past their 30-day recovery
      // window — no cron on the free tier, and the exact purge hour doesn't
      // matter, so it rides along instead of blocking the page
      supabase.rpc("purge_expired_leagues"),
    ]);

  // pending actions: live drafts in my leagues + missing availability
  const pending: PendingAction[] = [];
  if (leagues.length > 0) {
    for (const d of liveDraftsRes.data ?? []) {
      const season = d.season as unknown as {
        league: { slug: string; name: string } | null;
      } | null;
      if (season?.league) {
        pending.push({
          kind: "draft",
          label: `Draft is live in ${season.league.name}`,
          href: `/league/${season.league.slug}/draft`,
        });
      }
    }
    // one query for all seasons, not one per team
    if (myTeams.length > 0) {
      const { data: myAvailability } = await supabase
        .from("availability")
        .select("season_id")
        .eq("user_id", user.id)
        .in(
          "season_id",
          myTeams.map((t) => t.season_id),
        );
      const filled = new Set((myAvailability ?? []).map((a) => a.season_id));
      for (const team of myTeams) {
        if (!filled.has(team.season_id)) {
          pending.push({
            kind: "availability",
            label: `Fill out availability for ${team.league_name}`,
            href: `/league/${team.league_slug}/availability`,
          });
        }
      }
    }
  }

  return (
    <DashboardView
      firstName={name.split(" ")[0]}
      notice={notice}
      leagues={leagues}
      shelved={shelved}
      myTeams={myTeams}
      nextGame={nextGame}
      lastLine={lastLine}
      pending={pending}
    />
  );
}
