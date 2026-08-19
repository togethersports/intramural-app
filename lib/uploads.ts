import { createClient } from "@/lib/supabase/server";

/**
 * Image uploads for the three things that carry a picture: a person, a
 * league, and a team. One helper because the failure modes are identical and
 * each one has to name the fix rather than surface a storage error verbatim.
 */

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** Formats every browser can encode and every browser can display. */
const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type UploadResult =
  | { url: string; path: string; error: null }
  | { url: null; path: null; error: string };

/**
 * Put `file` in `bucket` under `folder/`, replacing whatever was there.
 *
 * The stored name is derived, never taken from the upload: a filename is
 * attacker-controlled, and these buckets are public.
 */
export async function uploadImage(
  bucket: "avatars" | "badges",
  folder: string,
  key: string,
  file: File,
): Promise<UploadResult> {
  if (file.size === 0) {
    return { url: null, path: null, error: "Choose an image first." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      url: null,
      path: null,
      error: "That image is over 4 MB — pick a smaller one, or crop it first.",
    };
  }
  const ext = EXTENSION[file.type];
  if (!ext) {
    return {
      url: null,
      path: null,
      error: "Use a JPG, PNG, WebP or GIF — that format can't be displayed.",
    };
  }

  const supabase = await createClient();
  // Cache-busted name so a replacement shows up immediately instead of
  // sitting behind the CDN copy of the file it replaced.
  const path = `${folder}/${key}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) {
    return {
      url: null,
      path: null,
      error: `Upload failed: ${error.message}. Try again, or pick a smaller image.`,
    };
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, path, error: null };
}

/**
 * Delete the object a public URL points at. Best effort — a stale blob is
 * cheaper than a failed save, so callers do not treat this as fatal.
 */
export async function removeUploadedImage(
  bucket: "avatars" | "badges",
  url: string | null,
): Promise<void> {
  if (!url) return;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const at = url.indexOf(marker);
  if (at === -1) return;
  const path = decodeURIComponent(url.slice(at + marker.length).split("?")[0]);
  if (!path) return;
  const supabase = await createClient();
  await supabase.storage.from(bucket).remove([path]);
}
