"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type ActionState = { error: string | null; notice?: string | null };

const NOT_CONFIGURED = "Backend not configured — see /setup.";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function revalidateLeague(slug: string) {
  revalidatePath(`/league/${slug}`, "layout");
}

/**
 * Propose some times for a game.
 *
 * A captain or an admin lists slots; the two teams vote. Options are dates
 * plus an optional gym slot and venue, so the winner can be written straight
 * onto the game — which is what puts it in front of the reminder sender.
 */
export async function createSchedulePoll(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { error: "Sign in again — your session expired." };

  const slug = str(formData, "slug");
  const homeTeamId = str(formData, "home_team_id");
  const awayTeamId = str(formData, "away_team_id");
  if (!homeTeamId || !awayTeamId) return { error: "Pick both teams." };
  if (homeTeamId === awayTeamId) {
    return { error: "A team can't play itself — pick two different teams." };
  }

  const dates = formData.getAll("option_date").map((d) => String(d).trim()).filter(Boolean);
  if (dates.length === 0) {
    return { error: "Add at least one date for people to vote on." };
  }
  if (dates.length > 8) {
    return { error: "Eight options is plenty — trim the list and try again." };
  }

  const slots = formData.getAll("option_slot").map((s) => String(s));
  const venues = formData.getAll("option_venue").map((v) => String(v));
  const closesAt = str(formData, "closes_at");

  const { data: poll, error } = await supabase
    .from("schedule_polls")
    .insert({
      season_id: str(formData, "season_id"),
      game_id: str(formData, "game_id") || null,
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      created_by: userRes.user.id,
      title: str(formData, "title").slice(0, 80),
      closes_at: closesAt ? new Date(closesAt).toISOString() : null,
    })
    .select("id")
    .single();
  if (error) {
    return {
      error: `${error.message}. Only a captain of one of these teams, or a league admin, can start a poll.`,
    };
  }

  const { error: optionError } = await supabase.from("schedule_poll_options").insert(
    dates.map((scheduled_date, i) => ({
      poll_id: poll.id,
      scheduled_date,
      time_slot_id: slots[i] || null,
      venue_id: venues[i] || null,
    })),
  );
  if (optionError) {
    // Don't leave a poll with nothing to vote on.
    await supabase.from("schedule_polls").delete().eq("id", poll.id);
    return { error: optionError.message };
  }

  for (const team of [homeTeamId, awayTeamId]) {
    await supabase.rpc("notify_team", {
      p_team: team,
      p_category: "schedule_change",
      p_title: "Vote on a game time",
      p_body: `${dates.length} option${dates.length === 1 ? "" : "s"} are up for your next game.`,
      p_link: `/league/${slug}/schedule`,
    });
  }

  revalidateLeague(slug);
  return { error: null, notice: "Poll opened. Both teams can vote now." };
}

/** One person's vote on one option. Re-voting overwrites. */
export async function castPollVote(formData: FormData) {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return;

  const vote = str(formData, "vote");
  if (!["yes", "maybe", "no"].includes(vote)) return;

  await supabase.from("schedule_poll_votes").upsert(
    { option_id: str(formData, "option_id"), user_id: userRes.user.id, vote },
    { onConflict: "option_id,user_id" },
  );
  revalidateLeague(str(formData, "slug"));
}

/**
 * Close a poll onto a slot.
 *
 * With no option named the RPC picks the winner itself — most yes votes, a
 * maybe worth half, ties breaking toward the earliest date. Writing the
 * result onto the game is what auto-locks it and hands it to the reminders.
 */
export async function lockSchedulePoll(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const supabase = await createClient();
  const slug = str(formData, "slug");

  const { error } = await supabase.rpc("lock_schedule_poll", {
    p_poll: str(formData, "poll_id"),
    p_option: str(formData, "option_id") || null,
  });
  if (error) return { error: error.message };

  const { data: poll } = await supabase
    .from("schedule_polls")
    .select("home_team_id, away_team_id")
    .eq("id", str(formData, "poll_id"))
    .maybeSingle();
  if (poll) {
    for (const team of [poll.home_team_id, poll.away_team_id]) {
      await supabase.rpc("notify_team", {
        p_team: team,
        p_category: "schedule_change",
        p_title: "Game time locked",
        p_body: "Your next game has a time. Reminders will go out automatically.",
        p_link: `/league/${slug}/schedule`,
      });
    }
  }

  revalidateLeague(slug);
  return { error: null, notice: "Locked. It's on the schedule and reminders are set." };
}

export async function cancelSchedulePoll(formData: FormData) {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  await supabase
    .from("schedule_polls")
    .update({ status: "cancelled" })
    .eq("id", str(formData, "poll_id"))
    .eq("status", "open");
  revalidateLeague(str(formData, "slug"));
}
