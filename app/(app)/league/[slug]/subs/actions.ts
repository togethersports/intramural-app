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
 * "I can't make this one."
 *
 * Flags the absence and — depending on scope — tells the team, or the whole
 * league's sub pool, that there is a hole. Opening the request is
 * deliberately not gated: anyone can say they're out, and anyone can offer
 * to fill in. The gate is the *approval*, one step later, which is where a
 * team could otherwise quietly hand itself a ringer.
 */
export async function flagAbsence(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { error: "Sign in again — your session expired." };

  const gameId = str(formData, "game_id");
  const teamId = str(formData, "team_id");
  const slug = str(formData, "slug");
  const scope = str(formData, "scope") === "team" ? "team" : "league";
  const reason = str(formData, "reason").slice(0, 140);

  const { error: absenceError } = await supabase.from("game_absences").upsert(
    { game_id: gameId, user_id: userRes.user.id, team_id: teamId, reason },
    { onConflict: "game_id,user_id" },
  );
  if (absenceError) return { error: absenceError.message };

  // One open request per absence — flagging twice shouldn't spam the pool.
  const { data: existing } = await supabase
    .from("sub_requests")
    .select("id")
    .eq("game_id", gameId)
    .eq("absent_user_id", userRes.user.id)
    .in("status", ["open", "proposed", "approved"])
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase.from("sub_requests").insert({
      game_id: gameId,
      team_id: teamId,
      requested_by: userRes.user.id,
      absent_user_id: userRes.user.id,
      scope,
      note: reason,
    });
    if (error) return { error: error.message };

    await supabase.rpc("notify_team", {
      p_team: teamId,
      p_category: "scorekeeper",
      p_title: "A teammate is out",
      p_body: reason
        ? `Someone can't make the next game — ${reason}. A sub is needed.`
        : "Someone can't make the next game. A sub is needed.",
      p_link: `/league/${slug}/game/${gameId}`,
    });
  }

  revalidateLeague(slug);
  return {
    error: null,
    notice:
      scope === "league"
        ? "Flagged. Your team and the league sub pool have been told."
        : "Flagged. Your team has been told.",
  };
}

/** Undo an absence, and withdraw the request it opened if nobody has stepped in. */
export async function clearAbsence(formData: FormData) {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return;

  const gameId = str(formData, "game_id");
  await supabase
    .from("game_absences")
    .delete()
    .eq("game_id", gameId)
    .eq("user_id", userRes.user.id);

  // Only withdraw a request nobody has acted on. Once a sub is approved the
  // record stands — the box score will refer to it.
  await supabase
    .from("sub_requests")
    .update({ status: "cancelled" })
    .eq("game_id", gameId)
    .eq("absent_user_id", userRes.user.id)
    .eq("status", "open");

  revalidateLeague(str(formData, "slug"));
}

/**
 * Put a name to an open request.
 *
 * Either the volunteer themselves, or a captain nominating somebody. Moves
 * it to `proposed`, which is the state the opposing captain then decides.
 */
export async function proposeSub(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { error: "Sign in again — your session expired." };

  const requestId = str(formData, "request_id");
  const slug = str(formData, "slug");
  const fillUserId = str(formData, "fill_user_id") || userRes.user.id;

  // Through the RPC, not a plain update: at policy-evaluation time the
  // volunteer is not yet on the row, so no row policy could let them claim
  // it — which is exactly the league-wide-pool case this feature is for.
  const { error } = await supabase.rpc("claim_sub_request", {
    p_request: requestId,
    p_fill: fillUserId,
  });
  if (error) return { error: error.message };

  const { data: request } = await supabase
    .from("sub_requests")
    .select("id, game_id, team_id")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) return { error: null, notice: "Put forward." };

  // Tell the side that has to sign off, not the side that asked.
  const { data: game } = await supabase
    .from("games")
    .select("home_team_id, away_team_id")
    .eq("id", request.game_id)
    .maybeSingle();
  if (game) {
    const opponent =
      game.home_team_id === request.team_id ? game.away_team_id : game.home_team_id;
    await supabase.rpc("notify_team", {
      p_team: opponent,
      p_category: "scorekeeper",
      p_title: "A sub needs your approval",
      p_body: "The other team has put a sub forward for your next game.",
      p_link: `/league/${slug}/game/${request.game_id}`,
    });
  }

  revalidateLeague(slug);
  return { error: null, notice: "Put forward. The other captain has to approve it." };
}

/**
 * Approve or decline a specific sub.
 *
 * Goes through the `decide_sub_request` RPC rather than a direct update
 * because the rule is a *transition* — only a proposed request can be
 * decided, and only by the opposing captain or an admin. A row policy can't
 * see the previous status, so it can't enforce that on its own.
 */
export async function decideSub(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const supabase = await createClient();
  const slug = str(formData, "slug");
  const approve = str(formData, "decision") === "approve";

  const { error } = await supabase.rpc("decide_sub_request", {
    p_request: str(formData, "request_id"),
    p_approve: approve,
    p_note: str(formData, "decision_note").slice(0, 140),
  });
  if (error) return { error: error.message };

  const { data: request } = await supabase
    .from("sub_requests")
    .select("game_id, team_id")
    .eq("id", str(formData, "request_id"))
    .maybeSingle();
  if (request) {
    await supabase.rpc("notify_team", {
      p_team: request.team_id,
      p_category: "scorekeeper",
      p_title: approve ? "Your sub was approved" : "Your sub was declined",
      p_body: approve
        ? "The other captain signed off. They're on the roster for this game."
        : "The other captain declined this sub. Put somebody else forward.",
      p_link: `/league/${slug}/game/${request.game_id}`,
    });
  }

  revalidateLeague(slug);
  return {
    error: null,
    notice: approve ? "Approved — they're on the roster." : "Declined.",
  };
}

/** A captain or the requester withdrawing a request outright. */
export async function cancelSubRequest(formData: FormData) {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  await supabase
    .from("sub_requests")
    .update({ status: "cancelled" })
    .eq("id", str(formData, "request_id"))
    .in("status", ["open", "proposed"]);
  revalidateLeague(str(formData, "slug"));
}
