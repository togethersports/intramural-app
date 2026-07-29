"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type ActionState = { error: string | null };

const NOT_CONFIGURED =
  "The backend isn't connected yet. Add your Supabase keys — see the Setup page.";

export async function createLeague(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const name = String(formData.get("name") ?? "").trim();
  const sport = String(formData.get("sport") ?? "basketball");
  const color = String(formData.get("color") ?? "#c8232c");
  const orgName = String(formData.get("org_name") ?? "").trim();

  if (name.length < 3)
    return { error: "League name must be at least 3 characters." };

  const supabase = await createClient();
  const { data: slug, error } = await supabase.rpc("create_league", {
    p_name: name,
    p_sport: sport,
    p_color: color,
    p_org_name: orgName || null,
  });
  if (error) return { error: error.message };
  redirect(`/league/${slug}`);
}

export async function joinLeague(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const code = String(formData.get("code") ?? "").trim();
  if (code.length < 6) return { error: "Join codes are 6 characters." };

  const supabase = await createClient();
  const { data: slug, error } = await supabase.rpc("join_league_with_code", {
    p_code: code,
  });
  if (error) return { error: error.message };
  redirect(`/league/${slug}`);
}

export async function updateMemberRole(formData: FormData) {
  if (!isSupabaseConfigured()) return;
  const memberId = String(formData.get("member_id") ?? "");
  const role = String(formData.get("role") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const allowed = ["admin", "captain", "player", "spectator"];
  if (!memberId || !allowed.includes(role)) return;

  const supabase = await createClient();
  // RLS: only commissioners/admins can update, and admins can't touch
  // the commissioner's row or grant the commissioner role.
  await supabase.from("league_members").update({ role }).eq("id", memberId);
  revalidatePath(`/league/${slug}/members`);
}

export async function removeMember(formData: FormData) {
  if (!isSupabaseConfigured()) return;
  const memberId = String(formData.get("member_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!memberId) return;

  const supabase = await createClient();
  await supabase
    .from("league_members")
    .update({ status: "removed" })
    .eq("id", memberId);
  revalidatePath(`/league/${slug}/members`);
}
