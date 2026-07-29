import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { cache } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * Deduped per request (layouts and pages both call this — without cache()
 * each call was a separate network round trip to Supabase auth). The cookie
 * short-circuit means anonymous visitors cost zero Supabase calls.
 */
export const getUser = cache(async () => {
  if (!isSupabaseConfigured()) return null;
  const cookieStore = await cookies();
  const hasAuthCookie = cookieStore
    .getAll()
    .some((c) => c.name.startsWith("sb-"));
  if (!hasAuthCookie) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
});

/** Gate for authenticated pages. Redirects to /setup when the backend
 *  isn't configured, or to /login when there's no session. */
export async function requireUser() {
  if (!isSupabaseConfigured()) redirect("/setup");
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
