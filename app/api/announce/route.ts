/**
 * The phone app's way to post an announcement.
 *
 * The app cannot deliver push itself — the APNs key lives here — so it posts
 * the announcement through this route and the server does the buzzing. The
 * RPC underneath re-checks that the caller is a league admin under their own
 * identity, so this route adds no authority: it only adds the key.
 */

import { NextResponse } from "next/server";
import { postAnnouncement } from "@/lib/announce";
import { bearerFrom, createBearerClient } from "@/lib/supabase/bearer";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "not-configured" }, { status: 503 });
  }
  const bearer = bearerFrom(request);
  if (!bearer) {
    return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  }

  let payload: {
    leagueId?: unknown;
    title?: unknown;
    body?: unknown;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body must be JSON." }, { status: 400 });
  }

  const leagueId = String(payload.leagueId ?? "");
  const title = String(payload.title ?? "").trim();
  const body = String(payload.body ?? "").trim();
  if (!leagueId || !title) {
    return NextResponse.json(
      { ok: false, error: "leagueId and title are required." },
      { status: 400 },
    );
  }

  const supabase = createBearerClient(bearer);
  // Name and slug for the push copy and deep link — also a cheap existence
  // check under the caller's RLS before anything is written.
  const { data: league } = await supabase
    .from("leagues")
    .select("slug, name")
    .eq("id", leagueId)
    .maybeSingle();
  if (!league) {
    return NextResponse.json({ ok: false, error: "League not found." }, { status: 404 });
  }

  const result = await postAnnouncement(supabase, {
    leagueId,
    leagueSlug: league.slug,
    leagueName: league.name,
    title,
    body,
  });
  if (result.error) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 403 });
  }
  return NextResponse.json({
    ok: true,
    devices: result.devices,
    delivered: result.delivered,
    detail: result.detail,
  });
}
