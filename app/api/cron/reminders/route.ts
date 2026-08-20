import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cron";
import {
  channelsFor,
  renderEmailHtml,
  sendEmail,
  sendSms,
  type Channel,
  type NotifyChannel,
} from "@/lib/notify";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { absoluteUrl } from "@/lib/site";
import {
  dueKinds,
  emailBody,
  emailSubject,
  smsBody,
  type ReminderContext,
  type ReminderKind,
} from "@core/reminders";

/**
 * The reminder sender.
 *
 * Runs on a fixed cadence (see vercel.json) and asks one question: which
 * games have a reminder due right now. `@core/reminders` owns the timing —
 * this route owns the fan-out and, more importantly, the guarantee that a
 * person is never told twice.
 *
 * That guarantee is an insert, not a check: every (game, player, kind,
 * channel) is written to `reminder_log` with a unique constraint *before*
 * the message is sent. Two overlapping runs race on the insert and exactly
 * one wins; the loser skips. Checking-then-sending would leave a window.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** How far ahead to look. Comfortably past the widest reminder window. */
const HORIZON_HOURS = 30;

interface ScheduleRow {
  game_id: string;
  league_slug: string;
  league_name: string;
  timezone: string;
  status: string;
  home_team_id: string;
  away_team_id: string;
  slot_label: string | null;
  venue_name: string | null;
  starts_at: string;
}

interface RecipientRow {
  user_id: string;
  team_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  notify_channel: NotifyChannel;
}

export async function GET(request: Request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  if (!isAdminConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "SUPABASE_SERVICE_ROLE_KEY is not set — the reminder job reads across every league and cannot use a signed-in session.",
      },
      { status: 503 },
    );
  }

  const supabase = createAdminClient();
  const now = new Date();
  const horizon = new Date(now.getTime() + HORIZON_HOURS * 3_600_000);
  const floor = new Date(now.getTime() - 2 * 3_600_000);

  const { data: games, error: gamesError } = await supabase
    .from("game_schedule")
    .select(
      "game_id, league_slug, league_name, timezone, status, home_team_id, away_team_id, slot_label, venue_name, starts_at",
    )
    .in("status", ["scheduled", "postponed"])
    .gte("starts_at", floor.toISOString())
    .lte("starts_at", horizon.toISOString());

  if (gamesError) {
    return NextResponse.json({ ok: false, error: gamesError.message }, { status: 500 });
  }

  const rows = (games ?? []) as ScheduleRow[];
  const work: { game: ScheduleRow; kind: ReminderKind }[] = [];
  for (const game of rows) {
    for (const kind of dueKinds(
      { gameId: game.game_id, startsAt: game.starts_at, timezone: game.timezone, status: game.status },
      now,
    )) {
      work.push({ game, kind });
    }
  }

  if (work.length === 0) {
    return NextResponse.json({ ok: true, considered: rows.length, due: 0, sent: 0 });
  }

  // Team names for the "vs" line, fetched once for every team in play.
  const teamIds = [
    ...new Set(work.flatMap((w) => [w.game.home_team_id, w.game.away_team_id])),
  ];
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name")
    .in("id", teamIds);
  const teamName = new Map<string, string>(
    (teams ?? []).map((t) => [t.id as string, t.name as string]),
  );

  const { data: roster } = await supabase
    .from("team_members")
    .select(
      "user_id, team_id, profile:profiles(full_name, email, phone, notify_channel)",
    )
    .in("team_id", teamIds)
    .is("left_at", null);

  const byTeam = new Map<string, RecipientRow[]>();
  for (const m of roster ?? []) {
    const profile = m.profile as unknown as {
      full_name: string;
      email: string | null;
      phone: string | null;
      notify_channel: NotifyChannel;
    } | null;
    const list = byTeam.get(m.team_id as string) ?? [];
    list.push({
      user_id: m.user_id as string,
      team_id: m.team_id as string,
      full_name: profile?.full_name || "Player",
      email: profile?.email ?? null,
      phone: profile?.phone ?? null,
      notify_channel: profile?.notify_channel ?? "email",
    });
    byTeam.set(m.team_id as string, list);
  }

  // Somebody who has already said they can't make this game does not need
  // three reminders about it.
  const { data: absences } = await supabase
    .from("game_absences")
    .select("game_id, user_id")
    .in("game_id", [...new Set(work.map((w) => w.game.game_id))]);
  const absent = new Set(
    (absences ?? []).map((a) => `${a.game_id}:${a.user_id}`),
  );

  let sent = 0;
  let failed = 0;
  let alreadyDone = 0;

  for (const { game, kind } of work) {
    for (const side of ["home", "away"] as const) {
      const teamId = side === "home" ? game.home_team_id : game.away_team_id;
      const opponentId = side === "home" ? game.away_team_id : game.home_team_id;

      for (const player of byTeam.get(teamId) ?? []) {
        if (absent.has(`${game.game_id}:${player.user_id}`)) continue;

        const channels = channelsFor(player.notify_channel, {
          email: player.email,
          phone: player.phone,
        });
        if (channels.length === 0) continue;

        const ctx: ReminderContext = {
          playerName: player.full_name,
          teamName: teamName.get(teamId) ?? "Your team",
          opponentName: teamName.get(opponentId) ?? "the other team",
          isHome: side === "home",
          startsAt: game.starts_at,
          timezone: game.timezone,
          venueName: game.venue_name,
          slotLabel: game.slot_label,
          leagueName: game.league_name,
          url: absoluteUrl(`/league/${game.league_slug}/game/${game.game_id}`),
        };

        for (const channel of channels) {
          // Claim first. The unique index is what makes a double-fire safe:
          // the second run collides here and never reaches the provider.
          const { error: claimError } = await supabase.from("reminder_log").insert({
            game_id: game.game_id,
            user_id: player.user_id,
            kind,
            channel,
            ok: true,
            detail: "claimed",
          });
          if (claimError) {
            alreadyDone += 1;
            continue;
          }

          const result = await deliver(channel, kind, ctx, player);
          if (result.skipped) {
            // Nothing was sent, so release the claim — otherwise configuring
            // the provider later would never retroactively fix this game.
            await supabase
              .from("reminder_log")
              .delete()
              .eq("game_id", game.game_id)
              .eq("user_id", player.user_id)
              .eq("kind", kind)
              .eq("channel", channel);
            continue;
          }

          if (result.ok) sent += 1;
          else failed += 1;

          await supabase
            .from("reminder_log")
            .update({ ok: result.ok, detail: result.detail.slice(0, 500) })
            .eq("game_id", game.game_id)
            .eq("user_id", player.user_id)
            .eq("kind", kind)
            .eq("channel", channel);
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    considered: rows.length,
    due: work.length,
    sent,
    failed,
    alreadyDone,
  });
}

async function deliver(
  channel: Channel,
  kind: ReminderKind,
  ctx: ReminderContext,
  player: RecipientRow,
) {
  if (channel === "sms") {
    return sendSms({ to: player.phone ?? "", body: smsBody(kind, ctx) });
  }
  const text = emailBody(kind, ctx);
  return sendEmail({
    to: player.email ?? "",
    subject: emailSubject(kind, ctx),
    text,
    html: renderEmailHtml({ text, url: ctx.url, cta: "Open the game" }),
  });
}
