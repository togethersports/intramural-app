import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function getUser() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/** Gate for authenticated pages. Redirects to /setup when the backend
 *  isn't configured, or to /login when there's no session. */
export async function requireUser() {
  if (!isSupabaseConfigured()) redirect("/setup");
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
