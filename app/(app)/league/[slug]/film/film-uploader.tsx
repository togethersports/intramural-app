"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button, Field, FormError, FormNotice, Input, Select } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { PREFLIGHT } from "@core/vision";
import { createRecording } from "./actions";

/** Read duration and frame size out of the file itself, so the review room
    knows how long the film is without waiting on the pipeline. Best effort:
    a codec the browser cannot decode just leaves these null. */
function probe(
  file: File,
): Promise<{ durationS: number | null; width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const done = (v: {
      durationS: number | null;
      width: number | null;
      height: number | null;
    }) => {
      URL.revokeObjectURL(url);
      resolve(v);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () =>
      done({
        durationS: Number.isFinite(video.duration) ? Math.round(video.duration) : null,
        width: video.videoWidth || null,
        height: video.videoHeight || null,
      });
    video.onerror = () => done({ durationS: null, width: null, height: null });
    video.src = url;
  });
}

function formatBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 ** 2) return `${Math.round(n / 1024 ** 2)} MB`;
  return `${Math.round(n / 1024)} KB`;
}

export function FilmUploader({
  slug,
  leagueId,
  games,
}: {
  slug: string;
  leagueId: string;
  games: { id: string; label: string }[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const uploading = pct !== null;

  async function upload(formData: FormData) {
    setError(null);
    setNotice(null);
    const gameId = String(formData.get("game_id") ?? "");
    const cameraNote = String(formData.get("camera_note") ?? "");
    if (!file) return setError("Choose a video file first.");
    if (!gameId) return setError("Pick the game this film is of.");

    const supabase = createClient();
    const ext = (file.name.split(".").pop() ?? "mp4").toLowerCase().slice(0, 5);
    const path = `${leagueId}/${crypto.randomUUID()}.${ext}`;

    setPct(0);
    try {
      const { data: signed, error: signError } = await supabase.storage
        .from("film")
        .createSignedUploadUrl(path);
      if (signError || !signed) {
        throw new Error(
          signError?.message ??
            "Could not start the upload. Check that the film bucket exists.",
        );
      }

      // XHR rather than fetch: a multi-gigabyte upload without a progress bar
      // is indistinguishable from a hang.
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", signed.signedUrl);
        xhr.setRequestHeader("content-type", file.type || "video/mp4");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setPct(e.loaded / e.total);
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`The upload was rejected (${xhr.status}). Try again.`));
        xhr.onerror = () =>
          reject(new Error("The network dropped mid-upload. Try again on wifi."));
        xhr.send(file);
      });

      const meta = await probe(file);
      const res = await createRecording(slug, gameId, {
        storagePath: path,
        sizeBytes: file.size,
        cameraNote,
        ...meta,
      });
      if (res.error) throw new Error(res.error);

      setPct(null);
      setFile(null);
      formRef.current?.reset();
      setNotice("Film uploaded. Draw the rim box on it, then queue it.");
      if (res.recordingId) router.push(`/league/${slug}/film/${res.recordingId}`);
      router.refresh();
    } catch (err) {
      setPct(null);
      setError(err instanceof Error ? err.message : "The upload failed. Try again.");
    }
  }

  return (
    <form ref={formRef} action={upload} className="space-y-4">
      <FormError message={error} />
      <FormNotice message={notice} />

      {/* These were checkboxes you had to tick before the button unlocked.
          They are the same advice, stated once — the shoot is over by the
          time anyone is on this screen, so gating the upload on a promise
          about it only cost a click. */}
      <details className="row px-4 py-3">
        <summary className="cursor-pointer text-[15px] font-medium">
          How to shoot film the scanner can read
        </summary>
        <ul className="mt-3 space-y-2">
          {PREFLIGHT.map((item) => (
            <li key={item.key}>
              <span className="block text-[15px] font-medium leading-snug">
                {item.title}
              </span>
              <span className="block text-sm leading-snug text-ink-muted">
                {item.body}
              </span>
            </li>
          ))}
        </ul>
      </details>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Game" htmlFor="film-game">
          <Select id="film-game" name="game_id" required>
            <option value="">Pick a game…</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Camera note"
          htmlFor="film-note"
          hint="Where it was mounted, so the next person copies it."
        >
          <Input
            id="film-note"
            name="camera_note"
            placeholder="Balcony rail, half court, south side"
          />
        </Field>
      </div>

      <Field label="Video file" htmlFor="film-file">
        <input
          id="film-file"
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full min-h-11 rounded-control border border-rule bg-paper px-4 py-2.5 text-[15px] file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:font-semibold file:text-on-ink"
        />
      </Field>

      {file ? (
        <p className="text-sm text-ink-muted">
          <span className="num">{formatBytes(file.size)}</span> · {file.name}
        </p>
      ) : null}

      {uploading ? (
        <div className="space-y-1.5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-tint">
            <div
              className="h-full rounded-full bg-accent transition-[width]"
              style={{ width: `${Math.round((pct ?? 0) * 100)}%` }}
            />
          </div>
          <p className="num text-sm text-ink-muted">
            {Math.round((pct ?? 0) * 100)}% uploaded — keep this tab open
          </p>
        </div>
      ) : null}

      <Button type="submit" variant="accent" disabled={uploading}>
        {uploading ? "Uploading…" : "Upload film"}
      </Button>
    </form>
  );
}
