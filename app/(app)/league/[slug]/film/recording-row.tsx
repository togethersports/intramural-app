"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { FormError } from "@/components/ui";
import type { RecordingRow as Recording } from "@core/types";
import { formatFilmClock } from "@core/vision";
import { deleteRecording } from "./actions";

/** Status copy the admin can act on, not a machine word. No green, no amber
    — ink for settled, red for anything that needs a hand (DESIGN.md). */
const STATUS: Record<string, { label: string; tone: "ink" | "accent" | "quiet" }> = {
  uploading: { label: "Ready to scan", tone: "quiet" },
  queued: { label: "Queued", tone: "quiet" },
  processing: { label: "Processing", tone: "quiet" },
  review: { label: "Ready to review", tone: "accent" },
  complete: { label: "Reviewed", tone: "ink" },
  failed: { label: "Failed", tone: "accent" },
};

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export function RecordingRow({
  slug,
  recording,
  matchup,
}: {
  slug: string;
  recording: Recording;
  matchup: ReactNode;
}) {
  const status = STATUS[recording.status] ?? STATUS.uploading;
  const days = daysUntil(recording.delete_after);

  return (
    <li className="row space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        {matchup}
        <Link
          href={`/league/${slug}/film/${recording.id}`}
          className="min-w-0 flex-1 truncate text-[17px] font-semibold hover:underline"
        >
          {recording.camera_note || "Game film"}
        </Link>
        {recording.duration_s ? (
          <span className="num text-[13px] text-ink-faint">
            {formatFilmClock(recording.duration_s * 1000)}
          </span>
        ) : null}
        <span
          className={
            status.tone === "accent"
              ? "label rounded-full bg-accent px-2.5 py-1 !text-[11px] !text-on-accent"
              : status.tone === "ink"
                ? "label rounded-full bg-ink px-2.5 py-1 !text-[11px] !text-on-ink"
                : "label rounded-full bg-rule px-2.5 py-1 !text-[11px]"
          }
        >
          {status.label}
        </span>
        <Link
          href={`/league/${slug}/film/${recording.id}`}
          className="inline-flex min-h-11 items-center rounded-full bg-ink px-4 text-sm font-semibold text-on-ink hover:opacity-90"
        >
          {recording.status === "review" ? "Review" : "Open"}
        </Link>
        <form action={deleteRecording}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="recording_id" value={recording.id} />
          <button className="min-h-11 rounded-full px-3 text-sm font-medium text-accent hover:bg-tint">
            Delete
          </button>
        </form>
      </div>

      {recording.error ? <FormError message={recording.error} /> : null}

      <p className="text-[13px] text-ink-faint">
        {recording.storage_path
          ? days > 0
            ? `Video deletes in ${days} day${days === 1 ? "" : "s"}. The stats stay.`
            : "Video is past its retention date and will be deleted on the next sweep."
          : "Video deleted by the retention policy. The confirmed stats are still in the box score."}
      </p>
    </li>
  );
}
