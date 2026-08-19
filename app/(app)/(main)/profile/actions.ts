"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { removeUploadedImage, uploadImage } from "@/lib/uploads";
import { isValidPosition, positionsFor } from "@core/league-constants";
import { normalizeHex } from "@core/theme";

export type ActionState = { error: string | null; notice?: string | null };

const NOT_CONFIGURED = "Backend not configured — see /setup.";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** Empty string, or out of range, means "not set" rather than zero. */
function optionalInt(
  formData: FormData,
  key: string,
  min: number,
  max: number,
): number | null {
  const raw = str(formData, key);
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

export async function updateProfile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const user = await getUser();
  if (!user) return { error: "Sign in again — your session expired." };

  const fullName = str(formData, "full_name");
  if (!fullName) {
    return { error: "Add your name — it is what teammates see on the roster." };
  }

  // Positions come from a fixed per-sport list, so anything not on it is a
  // forged field rather than a typo. Silently dropping is right here: the
  // checkboxes cannot produce one.
  const sport = str(formData, "sport") || "basketball";
  const positions = formData
    .getAll("positions")
    .map((p) => String(p))
    .filter((p) => isValidPosition(sport, p))
    .slice(0, positionsFor(sport).length);

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName.slice(0, 80),
      grade: optionalInt(formData, "grade", 1, 13),
      height_in: optionalInt(formData, "height_in", 36, 96),
      jersey_pref: optionalInt(formData, "jersey_pref", 0, 99),
      positions,
    })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { error: null, notice: "Profile saved." };
}

export async function updateProfilePhoto(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const user = await getUser();
  if (!user) return { error: "Sign in again — your session expired." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  const previous = (existing?.avatar_url as string | null) ?? null;

  if (str(formData, "intent") === "remove") {
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", user.id);
    if (error) return { error: error.message };
    await removeUploadedImage("avatars", previous);
    revalidatePath("/", "layout");
    return { error: null, notice: "Photo removed." };
  }

  const file = formData.get("photo");
  if (!(file instanceof File)) return { error: "Choose an image first." };

  const uploaded = await uploadImage("avatars", user.id, "me", file);
  if (uploaded.error) return { error: uploaded.error };

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: uploaded.url })
    .eq("id", user.id);
  if (error) {
    await removeUploadedImage("avatars", uploaded.url);
    return { error: error.message };
  }
  // Only after the row points at the new file — otherwise a failed update
  // would leave the profile referencing a blob that no longer exists.
  await removeUploadedImage("avatars", previous);
  revalidatePath("/", "layout");
  return { error: null, notice: "Photo updated." };
}

export async function updateMyAppearance(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const user = await getUser();
  if (!user) return { error: "Sign in again — your session expired." };

  const supabase = await createClient();

  // "Match my league" is stored as an empty object, not as a copy of the
  // league's colours — so a commissioner restyling the league still reaches
  // everyone who hasn't deliberately opted out.
  if (str(formData, "intent") === "clear") {
    const { error } = await supabase
      .from("profiles")
      .update({ appearance: {} })
      .eq("id", user.id);
    if (error) return { error: error.message };
    revalidatePath("/", "layout");
    return { error: null, notice: "Back to your league's colours." };
  }

  const preset = str(formData, "preset");
  if (preset !== "court" && preset !== "sideline") {
    return { error: "Pick one of the two themes." };
  }
  const accent = normalizeHex(str(formData, "accent"));
  if (!accent) {
    return { error: "Give the accent as a hex colour, like #FF5C48." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ appearance: { preset, accent } })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { error: null, notice: "Colours updated." };
}
