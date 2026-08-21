"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { RimRoi } from "@core/vision";

export type ActionState = { error: string | null; notice?: string | null };

const NOT_CONFIGURED = "Backend not configured — see /setup.";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function revalidateFilm(slug: string) {
  revalidatePath(`/league/${slug}/film`, "layout");
}

/* -------------------------------------------------------------- recordings --
   The film itself is uploaded straight from the browser to Supabase Storage
   (a 40-minute game is gigabytes — far past what a server action body will
   carry). This only records the row once the blob has landed. */

export async function createRecording(
  slug: string,
  gameId: string,
  meta: {
    storagePath: string;
    sizeBytes: number;
    durationS: number | null;
    width: number | null;
    height: number | null;
    cameraNote: string;
  },
): Promise<ActionState & { recordingId?: string }> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { error: "Not signed in" };

  const { data, error } = await supabase
    .from("recordings")
    .insert({
      game_id: gameId,
      uploaded_by: userRes.user.id,
      storage_path: meta.storagePath,
      size_bytes: meta.sizeBytes,
      duration_s: meta.durationS,
      width: meta.width,
      height: meta.height,
      camera_note: meta.cameraNote.slice(0, 200),
    })
    .select("id")
    .single();
  if (error) {
    // don't leave a multi-gigabyte orphan in the bucket
    await supabase.storage.from("film").remove([meta.storagePath]);
    return { error: error.message };
  }
  revalidateFilm(slug);
  return { error: null, recordingId: data.id as string };
}

export async function setRimRoi(
  slug: string,
  recordingId: string,
  roi: RimRoi | null,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const supabase = await createClient();
  const { error } = await supabase
    .from("recordings")
    .update({ rim_roi: roi })
    .eq("id", recordingId);
  if (error) return { error: error.message };
  revalidateFilm(slug);
  return { error: null, notice: roi ? "Rim box saved." : "Rim box cleared." };
}

/** Open the gate before a scan. The consent trigger fires on the transition
    to 'queued' — one revoked player on either roster and this raises, and
    the message names them. */
export async function beginScan(
  slug: string,
  recordingId: string,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const supabase = await createClient();

  const { data: recording } = await supabase
    .from("recordings")
    .select("rim_roi, storage_path")
    .eq("id", recordingId)
    .maybeSingle();
  if (!recording) return { error: "That recording is gone. Upload the film again." };
  if (!recording.storage_path) {
    return { error: "The film file was deleted by the retention policy. Upload it again." };
  }
  if (!recording.rim_roi) {
    return { error: "Drag a box around the rim first — the scanner watches that box." };
  }

  const { error } = await supabase
    .from("recordings")
    .update({ status: "queued", error: null })
    .eq("id", recordingId);
  if (error) return { error: error.message };
  revalidateFilm(slug);
  return { error: null };
}

/** Progress from the in-browser scanner — the same RPC a GPU worker uses,
    so the film page's status column is live either way. */
export async function reportScanProgress(
  recordingId: string,
  stage: "decode" | "detect" | "emit" | "done",
  progress: number,
  status: "running" | "succeeded" | "failed" = "running",
  errorMessage: string | null = null,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_vision_progress", {
    p_recording: recordingId,
    p_stage: stage,
    p_progress: Math.min(1, Math.max(0, progress)),
    p_status: status,
    p_model_version: SCANNER_VERSION,
    p_error: errorMessage,
  });
  return { error: error?.message ?? null };
}

const SCANNER_VERSION = "browser-motion-v1";

/** Candidates from the in-browser scanner. Same ingest RPC as a worker:
    idempotent per (type, ts_ms), re-checks consent, never overwrites a call
    a human already ruled on. Marks the run done on success. */
export async function ingestScanEvents(
  slug: string,
  recordingId: string,
  events: {
    type: string;
    ts_ms: number;
    confidence: number;
    payload?: Record<string, unknown>;
  }[],
): Promise<ActionState & { count?: number }> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ingest_detected_events", {
    p_recording: recordingId,
    p_model_version: SCANNER_VERSION,
    p_events: events,
  });
  if (error) {
    await supabase.rpc("set_vision_progress", {
      p_recording: recordingId,
      p_stage: "emit",
      p_progress: 0,
      p_status: "failed",
      p_model_version: SCANNER_VERSION,
      p_error: error.message,
    });
    return { error: error.message };
  }
  await supabase.rpc("set_vision_progress", {
    p_recording: recordingId,
    p_stage: "done",
    p_progress: 1,
    p_status: "succeeded",
    p_model_version: SCANNER_VERSION,
    p_error: null,
  });
  revalidateFilm(slug);
  return { error: null, count: (data as number) ?? 0 };
}

export async function deleteRecording(formData: FormData) {
  if (!isSupabaseConfigured()) return;
  const slug = str(formData, "slug");
  const recordingId = str(formData, "recording_id");
  const supabase = await createClient();
  const { data: recording } = await supabase
    .from("recordings")
    .select("storage_path")
    .eq("id", recordingId)
    .maybeSingle();
  if (recording?.storage_path) {
    await supabase.storage.from("film").remove([recording.storage_path]);
  }
  await supabase.from("recordings").delete().eq("id", recordingId);
  revalidateFilm(slug);
}

/* ------------------------------------------------------------------ review --
   All three go through SECURITY DEFINER RPCs: game_events only accepts
   inserts while a game is live, and film is reviewed after the whistle. */

export async function confirmDetected(
  slug: string,
  id: string,
  edit: {
    type?: string;
    userId?: string | null;
    guestId?: string | null;
    teamId?: string | null;
    period?: number;
    relatedUserId?: string | null;
  } = {},
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_detected_event", {
    p_id: id,
    p_type: edit.type ?? null,
    p_user: edit.userId ?? null,
    p_guest: edit.guestId ?? null,
    p_team: edit.teamId ?? null,
    p_period: edit.period ?? null,
    p_related_user: edit.relatedUserId ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/league/${slug}/game`, "layout");
  return { error: null };
}

export async function rejectDetected(slug: string, id: string): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_detected_event", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath(`/league/${slug}/game`, "layout");
  return { error: null };
}

export async function unreviewDetected(slug: string, id: string): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const supabase = await createClient();
  const { error } = await supabase.rpc("unreview_detected_event", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath(`/league/${slug}/game`, "layout");
  return { error: null };
}

/** Fouls, violations, and-ones — everything a camera cannot see. Lands in the
    same queue at full confidence so it rides the same confirm path. */
export async function addManualDetected(
  recordingId: string,
  gameId: string,
  event: {
    type: string;
    tsMs: number;
    period: number;
    userId: string | null;
    guestId: string | null;
    teamId: string | null;
  },
): Promise<ActionState & { id?: string }> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("detected_events")
    .insert({
      recording_id: recordingId,
      game_id: gameId,
      type: event.type,
      ts_ms: Math.max(0, Math.round(event.tsMs)),
      period: event.period,
      user_id: event.userId,
      guest_id: event.guestId,
      team_id: event.teamId,
      confidence: 1,
      source: "manual",
      model_version: "human",
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { error: null, id: data.id as string };
}

/* ----------------------------------------------------------------- consent -- */

export async function grantConsent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const slug = str(formData, "slug");
  const leagueId = str(formData, "league_id");
  const userId = str(formData, "user_id");
  const source = str(formData, "source") || "school_form";
  if (!userId) return { error: "Pick a player first." };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { error: "Not signed in" };

  const { error } = await supabase.from("consents").upsert(
    {
      league_id: leagueId,
      user_id: userId,
      granted_by: userRes.user.id,
      source,
      note: str(formData, "note").slice(0, 200),
      granted_at: new Date().toISOString(),
      revoked_at: null,
    },
    { onConflict: "league_id,user_id" },
  );
  if (error) return { error: error.message };
  revalidateFilm(slug);
  return { error: null, notice: "Consent recorded." };
}

/** Opting out is real (§7): the row stays so we can answer "was it on file
    when that film ran?", and processing stops for any game they are on. */
export async function revokeConsent(formData: FormData) {
  if (!isSupabaseConfigured()) return;
  const slug = str(formData, "slug");
  const supabase = await createClient();
  await supabase
    .from("consents")
    .update({ revoked_at: new Date().toISOString() })
    .eq("league_id", str(formData, "league_id"))
    .eq("user_id", str(formData, "user_id"));
  revalidateFilm(slug);
}
