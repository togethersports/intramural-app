/**
 * A Supabase client for callers that are not browsers.
 *
 * `lib/supabase/server.ts` reads the session from cookies, which is right
 * for every page and server action — and silently wrong for the native
 * apps: the watch and the phone authenticate API routes with an
 * `Authorization: Bearer <access token>` header and carry no cookies at
 * all. A cookie client in that position reports "signed out" for a caller
 * who is signed in, which is how the watch's push registration 401'd.
 *
 * This client pins the caller's token as the Authorization header, so
 * PostgREST evaluates RLS as them — same policies, same guarantees, no
 * cookies involved. It holds no session and refreshes nothing: refreshing
 * is the device's job, and a refresh here would race the device's own.
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createBearerClient(accessToken: string) {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

/** The token from an `Authorization: Bearer …` header, or null. */
export function bearerFrom(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1] : null;
}
