import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * The service-role client. Bypasses RLS entirely.
 *
 * Only two callers should ever exist: the cron routes, which have to read
 * across every league to find whose game starts in ten minutes, and which
 * have no signed-in user to borrow permissions from. Every other read goes
 * through `lib/supabase/server.ts` so RLS stays the single place access is
 * decided.
 *
 * `SUPABASE_SERVICE_ROLE_KEY` is a server-only variable — no NEXT_PUBLIC
 * prefix, so it can never reach the browser bundle. Importing this module
 * from a client component is a build error, which is the point.
 */
export function isAdminConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — the reminder and recap jobs need it to read across leagues. Add it to the server environment (never with a NEXT_PUBLIC prefix).",
    );
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
