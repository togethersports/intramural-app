/**
 * Posting an announcement, from anywhere.
 *
 * The database work is one RPC — `announce_league` checks the caller is an
 * admin, writes the announcement, and files an inbox notification for every
 * member, atomically. What comes back is the list of registered devices to
 * buzz, and this module's job is the buzzing. Both the web console's server
 * action and the phone app's API route call this, so the two ways of posting
 * cannot drift apart.
 *
 * Dead tokens are not retired here: that update touches other people's rows,
 * which the caller's RLS rightly forbids. The reminder cron runs with the
 * service role and already retires anything Apple 410s, so a stale token
 * costs one wasted send, once.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/notify/apns";

export interface AnnounceInput {
  leagueId: string;
  leagueSlug: string;
  leagueName: string;
  title: string;
  body: string;
}

export interface AnnounceResult {
  error: string | null;
  /** Devices the RPC said to notify. */
  devices: number;
  /** Sends APNs actually accepted — 0 with devices > 0 usually means the
      APNs key isn't configured, which the detail spells out. */
  delivered: number;
  detail: string;
}

export async function postAnnouncement(
  supabase: SupabaseClient,
  input: AnnounceInput,
): Promise<AnnounceResult> {
  const { data, error } = await supabase.rpc("announce_league", {
    p_league: input.leagueId,
    p_title: input.title,
    p_body: input.body,
  });
  if (error) {
    return { error: error.message, devices: 0, delivered: 0, detail: "" };
  }

  const devices = (data ?? []) as { token: string; bundle_id: string }[];
  let delivered = 0;
  let detail = "";

  // Bounded parallelism: a league is at most a few dozen devices, and eight
  // concurrent HTTP/2 sessions is plenty without turning the send into a
  // thundering herd from a serverless function.
  for (let i = 0; i < devices.length; i += 8) {
    const batch = devices.slice(i, i + 8);
    const results = await Promise.all(
      batch.map((d) =>
        sendPush({
          to: d.token,
          topic: d.bundle_id,
          title: input.title,
          body: input.body || input.leagueName,
          path: `/league/${input.leagueSlug}`,
        }),
      ),
    );
    for (const r of results) {
      if (r.result.ok && !r.result.skipped) delivered += 1;
      else detail = r.result.detail;
    }
  }

  return { error: null, devices: devices.length, delivered, detail };
}
