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

export interface MyProfile {
  id: string;
  full_name: string;
  /** Mirrored from auth.users so the reminder sender can read it. */
  email: string | null;
  phone: string | null;
  notify_channel: "email" | "sms" | "both" | "none";
  avatar_url: string | null;
  grade: number | null;
  height_in: number | null;
  jersey_pref: number | null;
  positions: string[];
  /** Personal palette override; `{}` means "use the league's". */
  appearance: Record<string, unknown>;
}

/**
 * The signed-in user's own profile row. Deduped per request: the shell needs
 * the name, photo and palette, and the page under it often needs the same
 * row — without cache() that was three round trips for one row.
 */
export const getMyProfile = cache(async (): Promise<MyProfile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, phone, notify_channel, avatar_url, grade, height_in, jersey_pref, positions, appearance",
    )
    .eq("id", user.id)
    .maybeSingle();
  const fallbackName =
    (user.user_metadata?.full_name as string | undefined) ||
    user.email ||
    "Player";
  if (!data) {
    return {
      id: user.id,
      full_name: fallbackName,
      email: user.email ?? null,
      phone: null,
      notify_channel: "email",
      avatar_url: null,
      grade: null,
      height_in: null,
      jersey_pref: null,
      positions: [],
      appearance: {},
    };
  }
  return {
    id: user.id,
    full_name: (data.full_name as string) || fallbackName,
    email: (data.email as string | null) ?? user.email ?? null,
    phone: (data.phone as string | null) ?? null,
    notify_channel:
      (data.notify_channel as MyProfile["notify_channel"]) ?? "email",
    avatar_url: (data.avatar_url as string | null) ?? null,
    grade: (data.grade as number | null) ?? null,
    height_in: (data.height_in as number | null) ?? null,
    jersey_pref: (data.jersey_pref as number | null) ?? null,
    positions: (data.positions as string[] | null) ?? [],
    appearance: (data.appearance as Record<string, unknown> | null) ?? {},
  };
});

/** The signed-in user's display name. */
export const getMyName = cache(async (): Promise<string> => {
  const profile = await getMyProfile();
  return profile?.full_name ?? "Player";
});

/** Gate for authenticated pages. Redirects to /setup when the backend
 *  isn't configured, or to /login when there's no session. */
export async function requireUser() {
  if (!isSupabaseConfigured()) redirect("/setup");
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
