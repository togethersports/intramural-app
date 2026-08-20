/**
 * Where a device says "this is my APNs token".
 *
 * A route rather than a server action because the caller is a Swift app, not
 * a form — server actions are a React transport and awkward to speak from
 * URLSession.
 *
 * The write goes through `lib/supabase/server.ts`, so it runs as the caller
 * under RLS and the "devices: own write" policy is what actually stops one
 * person registering a token against someone else's account. This route
 * never sees the service-role key, and must not: it is reachable by anyone
 * with a session.
 */

import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

/** Apple hands back 32 bytes as hex; reject anything that isn't that. */
const TOKEN = /^[0-9a-fA-F]{64}$/;

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "not-configured" }, { status: 503 });
  }

  let payload: { token?: unknown; platform?: unknown; bundleId?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body must be JSON." }, { status: 400 });
  }

  const token = String(payload.token ?? "");
  const bundleId = String(payload.bundleId ?? "");
  const platform = payload.platform === "ios" ? "ios" : "watchos";

  if (!TOKEN.test(token)) {
    return NextResponse.json(
      { ok: false, error: "token must be 64 hex characters." },
      { status: 400 },
    );
  }
  if (!bundleId) {
    return NextResponse.json(
      { ok: false, error: "bundleId is required — it is the APNs topic." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  }

  // Conflict on `token`, not on (user, token): Apple reissues the same token
  // to the same install, so when a watch changes hands the row must move to
  // the new owner rather than leave the old one still being pushed to.
  // `invalidated_at` is cleared because a token coming back is alive again.
  const { error } = await supabase
    .from("device_tokens")
    .upsert(
      {
        user_id: user.id,
        token,
        platform,
        bundle_id: bundleId,
        invalidated_at: null,
      },
      { onConflict: "token" },
    );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** Signing out on the device retires its token. */
export async function DELETE(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "not-configured" }, { status: 503 });
  }

  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!TOKEN.test(token)) {
    return NextResponse.json({ ok: false, error: "token required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  }

  // RLS scopes this to the caller's own rows regardless, but saying so here
  // means a policy change can never silently widen what this route deletes.
  const { error } = await supabase
    .from("device_tokens")
    .delete()
    .eq("token", token)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
