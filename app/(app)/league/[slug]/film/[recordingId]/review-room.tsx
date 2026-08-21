"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormError, FormNotice } from "@/components/ui";
import type { DetectedEventRow, RecordingRow, VisionJobRow } from "@core/types";
import {
  DETECTABLE_TYPES,
  afterDisposing,
  bulkConfirmable,
  confidenceBand,
  describeDetected,
  formatFilmClock,
  isShot,
  markerPosition,
  mergeCandidates,
  normalizeRoi,
  pointsFor,
  reviewProgress,
  reviewQueue,
  roiLooksUsable,
  seekTargetMs,
  stepQueue,
  toggleShotResult,
  toggleShotValue,
  type ReviewSort,
  type RimRoi,
  type ShotModel,
} from "@core/vision";
import {
  addManualDetected,
  confirmDetected,
  rejectDetected,
  setRimRoi,
  unreviewDetected,
} from "../actions";
import { ScanPanel } from "./scan-panel";

export interface ReviewSide {
  id: string;
  name: string;
  abbrev: string;
  color: string;
  roster: {
    id: string;
    playerId: string;
    name: string;
    isGuest: boolean;
    jersey: number | null;
  }[];
}

/** Confidence has three bands and three tones. No green, no amber. */
const BAND_DOT: Record<string, string> = {
  sure: "bg-ink",
  check: "bg-bench",
  shaky: "bg-accent",
};
const BAND_WORD: Record<string, string> = {
  sure: "confident",
  check: "worth a look",
  shaky: "shaky",
};

const SHORTCUTS = [
  ["J / K", "Next / previous call"],
  ["Enter", "Confirm"],
  ["X", "Reject"],
  ["U", "Send back to the queue"],
  ["1 – 5", "Tag a home player"],
  ["6 – 0", "Tag an away player"],
  ["T", "Two ⇄ three"],
  ["M", "Made ⇄ missed"],
  ["Space", "Play / pause"],
  ["← / →", "Step half a second"],
  ["A", "Add an event at the playhead"],
  ["?", "This list"],
] as const;

export function ReviewRoom({
  slug,
  recording,
  gameId,
  home,
  away,
  filmUrl,
  serverEvents,
  job,
  missingConsents,
  model,
}: {
  slug: string;
  recording: RecordingRow;
  gameId: string;
  home: ReviewSide;
  away: ReviewSide;
  filmUrl: string | null;
  serverEvents: DetectedEventRow[];
  job: VisionJobRow | null;
  missingConsents: { user_id: string; full_name: string }[];
  model: ShotModel;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [events, setEvents] = useState<DetectedEventRow[]>(serverEvents);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sort, setSort] = useState<ReviewSort>("confidence");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showKeys, setShowKeys] = useState(false);
  const [busy, setBusy] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  // Last player tagged, per side — repeat entry is the common case and
  // re-picking the same player 12 times is the slowest part of a pass.
  const [lastTagged, setLastTagged] = useState<string | null>(null);

  // Adjust local state during render when the server sends a fresh list
  // (router.refresh() after an ingest or a manual add) — an effect here would
  // paint the stale optimistic queue for a frame first.
  const [serverSnapshot, setServerSnapshot] = useState(serverEvents);
  if (serverSnapshot !== serverEvents) {
    setServerSnapshot(serverEvents);
    setEvents(serverEvents);
  }

  const durationMs = (recording.duration_s ?? 0) * 1000;
  const merged = useMemo(() => mergeCandidates(events), [events]);
  const queue = useMemo(() => reviewQueue(merged, sort), [merged, sort]);
  const progress = useMemo(() => reviewProgress(merged), [merged]);
  const selected = merged.find((e) => e.id === selectedId) ?? null;

  const slots = useMemo(() => {
    // 1–5 home, 6–0 away: the same key map as the courtside live console, so
    // an admin who tracks games already knows this keyboard.
    const keyed: { key: string; side: ReviewSide; player: ReviewSide["roster"][number] }[] = [];
    home.roster.slice(0, 5).forEach((p, i) =>
      keyed.push({ key: String(i + 1), side: home, player: p }),
    );
    away.roster.slice(0, 5).forEach((p, i) =>
      keyed.push({ key: i === 4 ? "0" : String(i + 6), side: away, player: p }),
    );
    return keyed;
  }, [home, away]);

  const seekTo = useCallback((ms: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = ms / 1000;
  }, []);

  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      const target = merged.find((e) => e.id === id);
      if (target) seekTo(seekTargetMs(target.ts_ms));
    },
    [merged, seekTo],
  );

  /* --------------------------------------------------------------- rulings */

  const patch = (id: string, next: Partial<DetectedEventRow>) =>
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...next } : e)));

  const confirm = useCallback(
    async (event: DetectedEventRow) => {
      setError(null);
      setBusy(true);
      const nextId = afterDisposing(queue, event.id);
      // optimistic: the queue must not stutter between keystrokes
      patch(event.id, { status: "confirmed" });
      const res = await confirmDetected(slug, event.id, {
        type: event.type,
        userId: event.user_id,
        guestId: event.guest_id,
        teamId: event.team_id,
        period: event.period,
      });
      setBusy(false);
      if (res.error) {
        patch(event.id, { status: "pending" });
        setError(res.error);
        return;
      }
      select(nextId);
    },
    [queue, slug, select],
  );

  const reject = useCallback(
    async (event: DetectedEventRow) => {
      setError(null);
      setBusy(true);
      const nextId = afterDisposing(queue, event.id);
      patch(event.id, { status: "rejected" });
      const res = await rejectDetected(slug, event.id);
      setBusy(false);
      if (res.error) {
        patch(event.id, { status: "pending" });
        setError(res.error);
        return;
      }
      select(nextId);
    },
    [queue, slug, select],
  );

  const unreview = useCallback(
    async (event: DetectedEventRow) => {
      setError(null);
      const before = event.status;
      patch(event.id, { status: "pending" });
      const res = await unreviewDetected(slug, event.id);
      if (res.error) {
        patch(event.id, { status: before });
        setError(res.error);
      }
    },
    [slug],
  );

  const tag = useCallback(
    (slot: { side: ReviewSide; player: ReviewSide["roster"][number] }) => {
      if (!selected) return;
      setLastTagged(slot.player.playerId);
      patch(selected.id, {
        user_id: slot.player.isGuest ? null : slot.player.playerId,
        guest_id: slot.player.isGuest ? slot.player.playerId : null,
        team_id: slot.side.id,
      });
    },
    [selected],
  );

  const confirmAllConfident = async () => {
    const batch = bulkConfirmable(merged);
    if (batch.length === 0) return;
    setBusy(true);
    setError(null);
    let done = 0;
    for (const e of batch) {
      const res = await confirmDetected(slug, e.id, {
        type: e.type,
        userId: e.user_id,
        guestId: e.guest_id,
        teamId: e.team_id,
        period: e.period,
      });
      if (res.error) {
        setError(res.error);
        break;
      }
      patch(e.id, { status: "confirmed" });
      done++;
    }
    setBusy(false);
    if (done > 0) setNotice(`Confirmed ${done} confident call${done === 1 ? "" : "s"}.`);
  };

  const addAtPlayhead = async () => {
    setError(null);
    const res = await addManualDetected(recording.id, gameId, {
      type: "pf",
      tsMs: playhead,
      period: selected?.period ?? 1,
      userId: null,
      guestId: null,
      teamId: null,
    });
    if (res.error) return setError(res.error);
    router.refresh();
    setNotice("Added an event at the playhead. Set its type and player, then confirm.");
  };

  /* -------------------------------------------------------------- keyboard */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key;
      if (key === "?") {
        setShowKeys((s) => !s);
        return;
      }
      if (key === "j" || key === "J") {
        e.preventDefault();
        select(stepQueue(queue, selectedId, 1));
        return;
      }
      if (key === "k" || key === "K") {
        e.preventDefault();
        select(stepQueue(queue, selectedId, -1));
        return;
      }
      if (key === " ") {
        e.preventDefault();
        const video = videoRef.current;
        if (video?.paused) void video.play();
        else video?.pause();
        return;
      }
      if (key === "ArrowLeft" || key === "ArrowRight") {
        e.preventDefault();
        const video = videoRef.current;
        if (video) video.currentTime += key === "ArrowRight" ? 0.5 : -0.5;
        return;
      }
      if (key === "a" || key === "A") {
        e.preventDefault();
        void addAtPlayhead();
        return;
      }
      if (!selected) return;

      if (key === "Enter") {
        e.preventDefault();
        void confirm(selected);
      } else if (key === "x" || key === "X") {
        e.preventDefault();
        void reject(selected);
      } else if (key === "u" || key === "U") {
        e.preventDefault();
        void unreview(selected);
      } else if (key === "t" || key === "T") {
        e.preventDefault();
        patch(selected.id, { type: toggleShotValue(selected.type) });
      } else if (key === "m" || key === "M") {
        e.preventDefault();
        patch(selected.id, { type: toggleShotResult(selected.type) });
      } else if (/^[0-9]$/.test(key)) {
        const slot = slots.find((s) => s.key === key);
        if (slot) {
          e.preventDefault();
          tag(slot);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // keep the selected row in view as J/K walks the list
  useEffect(() => {
    listRef.current
      ?.querySelector('[data-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  /* ----------------------------------------------------------- calibration */

  const needsRim = !recording.rim_roi;

  return (
    <div className="space-y-4">
      {missingConsents.length > 0 ? (
        <FormError
          message={`Film consent was revoked or is missing for ${missingConsents
            .map((m) => m.full_name)
            .join(", ")}. Re-grant it on the Film page — scanning is blocked until you do.`}
        />
      ) : null}
      <FormError message={error} />
      <FormNotice message={notice} />

      {job && job.status === "running" ? (
        <section className="card p-5">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="label">{job.stage}</span>
            <span className="num text-sm">{Math.round(job.progress * 100)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-tint">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.round(job.progress * 100)}%` }}
            />
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        {/* ------------------------------------------------------ the film */}
        <div className="space-y-3">
          <div className="card overflow-hidden">
            {filmUrl ? (
              <FilmStage
                ref={videoRef}
                src={filmUrl}
                roi={recording.rim_roi}
                calibrating={needsRim}
                onSaveRoi={async (roi) => {
                  const res = await setRimRoi(slug, recording.id, roi);
                  if (res.error) setError(res.error);
                  else {
                    setNotice(res.notice ?? null);
                    router.refresh();
                  }
                }}
                onTime={(ms) => setPlayhead(ms)}
              />
            ) : (
              <div className="grid aspect-video place-items-center bg-ink px-6 text-center">
                <p className="max-w-[42ch] text-[17px] font-medium text-on-ink">
                  {recording.storage_path
                    ? "The film could not be loaded. Its signed link may have expired — reload the page."
                    : "The video was deleted by the 30-day retention policy. The calls below are still reviewable."}
                </p>
              </div>
            )}

            <Scrubber
              events={merged}
              durationMs={durationMs}
              playhead={playhead}
              selectedId={selectedId}
              onPick={select}
            />
          </div>

          {selected ? (
            <SelectedCard
              event={selected}
              home={home}
              away={away}
              slots={slots}
              lastTagged={lastTagged}
              busy={busy}
              onType={(type) => patch(selected.id, { type })}
              onTag={tag}
              onConfirm={() => confirm(selected)}
              onReject={() => reject(selected)}
              onUnreview={() => unreview(selected)}
            />
          ) : (
            <div className="card p-5">
              <p className="text-[17px] font-medium">
                {queue.length > 0
                  ? "Press J to start on the shakiest call."
                  : progress.total === 0
                    ? "No calls yet. Draw the rim box, then hit Process on the Film page."
                    : "Every call is reviewed. The box score is up to date."}
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                Press ? for the full keyboard.
              </p>
            </div>
          )}
        </div>

        {/* ----------------------------------------------------- the queue */}
        <div className="space-y-3">
          <ScanPanel
            slug={slug}
            recording={recording}
            filmUrl={filmUrl}
            hasPending={queue.length > 0}
            model={model}
          />

          <section className="card p-5">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <span className="label">Review</span>
              <span className="num text-sm text-ink-muted">
                {progress.total - progress.pending}/{progress.total}
              </span>
            </div>
            <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-tint">
              <div
                className="h-full rounded-full bg-accent transition-[width]"
                style={{ width: `${Math.round(progress.pct * 100)}%` }}
              />
            </div>
            <p className="text-sm text-ink-muted">
              {progress.pending === 0
                ? `${progress.confirmed} confirmed, ${progress.rejected} rejected.`
                : `About ${Math.ceil(progress.secondsLeft / 60)} min left at four seconds a call.`}
            </p>
            {bulkConfirmable(merged).length > 0 ? (
              <button
                onClick={confirmAllConfident}
                disabled={busy}
                className="mt-3 min-h-11 w-full rounded-full bg-ink px-4 text-sm font-semibold text-on-ink hover:opacity-90 disabled:opacity-40"
              >
                Confirm {bulkConfirmable(merged).length} confident, tagged call
                {bulkConfirmable(merged).length === 1 ? "" : "s"}
              </button>
            ) : null}
          </section>

          <section className="card overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-rule px-4 py-3">
              <span className="label">
                {queue.length} to review
              </span>
              <div className="flex gap-1">
                {(["confidence", "time"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSort(s)}
                    aria-pressed={sort === s}
                    className={
                      sort === s
                        ? "min-h-11 rounded-full bg-ink px-3 text-[13px] font-semibold text-on-ink"
                        : "min-h-11 rounded-full px-3 text-[13px] font-medium text-ink-body hover:bg-rule"
                    }
                  >
                    {s === "confidence" ? "Shakiest first" : "Film order"}
                  </button>
                ))}
              </div>
            </div>
            <ul ref={listRef} className="max-h-[28rem] overflow-y-auto p-2">
              {queue.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-ink-faint">
                  Queue is empty.
                </li>
              ) : (
                queue.map((e) => {
                  const band = confidenceBand(e.confidence);
                  return (
                    <li key={e.id}>
                      <button
                        data-selected={e.id === selectedId}
                        onClick={() => select(e.id)}
                        className={
                          e.id === selectedId
                            ? "flex min-h-11 w-full items-center gap-3 rounded-row bg-tint px-3 py-2 text-left"
                            : "flex min-h-11 w-full items-center gap-3 rounded-row px-3 py-2 text-left hover:bg-paper"
                        }
                      >
                        <span
                          aria-hidden
                          className={`size-2.5 shrink-0 rounded-full ${BAND_DOT[band]}`}
                        />
                        <span className="num w-14 shrink-0 text-[13px] text-ink-faint">
                          {formatFilmClock(e.ts_ms)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
                          {describeDetected(e.type)}
                        </span>
                        <span className="num text-[13px] text-ink-faint">
                          {Math.round(e.confidence * 100)}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </section>

          <section className="card p-5">
            <h3 className="mb-1 text-[17px] font-semibold">
              What the camera cannot see
            </h3>
            <p className="mb-3 text-sm text-ink-muted">
              Fouls, violations, and-ones, charges. Add them by hand — press A
              to drop one at the playhead.
            </p>
            <Button onClick={addAtPlayhead} variant="quiet">
              Add event at {formatFilmClock(playhead)}
            </Button>
          </section>
        </div>
      </div>

      {showKeys ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-6"
          onClick={() => setShowKeys(false)}
        >
          <div className="card-float max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-lg font-semibold tracking-tight">Keyboard</h3>
            <dl className="space-y-1.5">
              {SHORTCUTS.map(([key, what]) => (
                <div key={key} className="flex items-baseline justify-between gap-4">
                  <dt className="num rounded-row bg-paper px-2 py-1 text-[13px]">{key}</dt>
                  <dd className="text-[15px] text-ink-body">{what}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- the stage --
   The video, plus the drag-a-box-around-the-rim overlay. The box is stored as
   a fraction of the frame so it survives the transcode to 720p. */

function FilmStage({
  ref,
  src,
  roi,
  calibrating,
  onSaveRoi,
  onTime,
}: {
  ref: React.RefObject<HTMLVideoElement | null>;
  src: string;
  roi: RimRoi | null;
  calibrating: boolean;
  onSaveRoi: (roi: RimRoi | null) => void | Promise<void>;
  onTime: (ms: number) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(
    null,
  );
  const [draft, setDraft] = useState<RimRoi | null>(null);
  const active = draft ?? roi;

  const rect = () => boxRef.current?.getBoundingClientRect() ?? null;

  const point = (e: React.PointerEvent) => {
    const r = rect();
    if (!r) return null;
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div className="space-y-0">
      <div
        ref={boxRef}
        className="relative select-none bg-ink"
        onPointerDown={(e) => {
          if (!calibrating && !draft) return;
          const p = point(e);
          if (!p) return;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
        }}
        onPointerMove={(e) => {
          if (!drag) return;
          const p = point(e);
          if (p) setDrag({ ...drag, x1: p.x, y1: p.y });
        }}
        onPointerUp={() => {
          const r = rect();
          if (!drag || !r) return setDrag(null);
          const box = {
            x: Math.min(drag.x0, drag.x1),
            y: Math.min(drag.y0, drag.y1),
            w: Math.abs(drag.x1 - drag.x0),
            h: Math.abs(drag.y1 - drag.y0),
          };
          setDrag(null);
          setDraft(normalizeRoi(box, r.width, r.height));
        }}
      >
        <video
          ref={ref}
          src={src}
          controls={!calibrating && !draft}
          playsInline
          preload="metadata"
          onTimeUpdate={(e) => onTime(Math.round(e.currentTarget.currentTime * 1000))}
          className="block max-h-[62vh] w-full bg-ink"
        />

        {/* live drag rectangle */}
        {drag ? (
          <div
            aria-hidden
            className="pointer-events-none absolute border-2 border-accent bg-accent/15"
            style={{
              left: Math.min(drag.x0, drag.x1),
              top: Math.min(drag.y0, drag.y1),
              width: Math.abs(drag.x1 - drag.x0),
              height: Math.abs(drag.y1 - drag.y0),
            }}
          />
        ) : active ? (
          <div
            aria-hidden
            className="pointer-events-none absolute border-2 border-accent"
            style={{
              left: `${active.x * 100}%`,
              top: `${active.y * 100}%`,
              width: `${active.w * 100}%`,
              height: `${active.h * 100}%`,
            }}
          />
        ) : null}
      </div>

      {calibrating || draft ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-rule px-4 py-3">
          <p className="min-w-[16rem] flex-1 text-sm text-ink-body">
            {draft
              ? roiLooksUsable(draft)
                ? "That is the crop the model watches. Save it, or drag again."
                : "That box is too small or too large to be a rim. Drag a tighter one around the hoop and backboard."
              : "Scrub to a frame where the rim is clear, then drag a box around the hoop and backboard."}
          </p>
          {draft ? (
            <>
              <Button
                variant="accent"
                disabled={!roiLooksUsable(draft)}
                onClick={() => {
                  void onSaveRoi(draft);
                  setDraft(null);
                }}
              >
                Save rim box
              </Button>
              <Button variant="quiet" onClick={() => setDraft(null)}>
                Drag again
              </Button>
            </>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 border-t border-rule px-4 py-3">
          <p className="min-w-[16rem] flex-1 text-sm text-ink-muted">
            Rim box saved. The pipeline crops to it for the whole film.
          </p>
          <Button variant="quiet" onClick={() => setDraft(roi)}>
            Redraw rim box
          </Button>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- scrubber --
   Every candidate as a tick, coloured by confidence, clickable. This is how a
   reviewer sees the shape of a game at a glance. */

function Scrubber({
  events,
  durationMs,
  playhead,
  selectedId,
  onPick,
}: {
  events: DetectedEventRow[];
  durationMs: number;
  playhead: number;
  selectedId: string | null;
  onPick: (id: string) => void;
}) {
  if (durationMs <= 0) {
    return (
      <p className="border-t border-rule px-4 py-3 text-sm text-ink-faint">
        Film length unknown, so the marker strip is hidden. The queue still works.
      </p>
    );
  }
  return (
    <div className="border-t border-rule px-4 py-3">
      <div className="relative h-8 rounded-row bg-paper">
        {events.map((e) => {
          const left = markerPosition(e.ts_ms, durationMs) * 100;
          const band = confidenceBand(e.confidence);
          const done = e.status !== "pending";
          return (
            <button
              key={e.id}
              onClick={() => onPick(e.id)}
              title={`${formatFilmClock(e.ts_ms)} · ${describeDetected(e.type)} · ${BAND_WORD[band]}`}
              aria-label={`${describeDetected(e.type)} at ${formatFilmClock(e.ts_ms)}`}
              style={{ left: `${left}%` }}
              className={`absolute top-1 h-6 w-1.5 -translate-x-1/2 rounded-full ${
                done ? "bg-rule" : BAND_DOT[band]
              } ${e.id === selectedId ? "ring-2 ring-ink ring-offset-1" : ""}`}
            />
          );
        })}
        <div
          aria-hidden
          className="absolute inset-y-0 w-0.5 bg-ink"
          style={{ left: `${markerPosition(playhead, durationMs) * 100}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between">
        <span className="num text-[13px] text-ink-faint">{formatFilmClock(playhead)}</span>
        <span className="num text-[13px] text-ink-faint">{formatFilmClock(durationMs)}</span>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- selected call -- */

function SelectedCard({
  event,
  home,
  away,
  slots,
  lastTagged,
  busy,
  onType,
  onTag,
  onConfirm,
  onReject,
  onUnreview,
}: {
  event: DetectedEventRow;
  home: ReviewSide;
  away: ReviewSide;
  slots: { key: string; side: ReviewSide; player: ReviewSide["roster"][number] }[];
  lastTagged: string | null;
  busy: boolean;
  onType: (type: string) => void;
  onTag: (slot: { side: ReviewSide; player: ReviewSide["roster"][number] }) => void;
  onConfirm: () => void;
  onReject: () => void;
  onUnreview: () => void;
}) {
  const band = confidenceBand(event.confidence);
  const taggedId = event.user_id ?? event.guest_id;
  const tagged = slots.find((s) => s.player.playerId === taggedId);
  const points = pointsFor(event.type);

  return (
    <section className="card p-5">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="num text-[13px] text-ink-faint">
          {formatFilmClock(event.ts_ms)}
        </span>
        <h2 className="text-[22px] font-semibold tracking-tight">
          {describeDetected(event.type)}
        </h2>
        {points > 0 ? (
          <span className="chip-stat num">+{points}</span>
        ) : null}
        <span className="flex items-center gap-2 text-sm text-ink-muted">
          <span aria-hidden className={`size-2.5 rounded-full ${BAND_DOT[band]}`} />
          {event.source === "manual" ? "added by hand" : BAND_WORD[band]}
          {event.source === "model" ? (
            <span className="num">{Math.round(event.confidence * 100)}%</span>
          ) : null}
        </span>
        {event.status !== "pending" ? (
          <span className="label rounded-full bg-ink px-2.5 py-1 !text-[11px] !text-on-ink">
            {event.status}
          </span>
        ) : null}
      </div>

      {/* type */}
      <div className="mb-4">
        <span className="label mb-1.5 block">Call</span>
        <div className="flex flex-wrap gap-1.5">
          {DETECTABLE_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => onType(t)}
              aria-pressed={event.type === t}
              className={
                event.type === t
                  ? "min-h-11 rounded-full bg-ink px-3.5 text-[13px] font-semibold text-on-ink"
                  : "min-h-11 rounded-full bg-paper px-3.5 text-[13px] font-medium text-ink-body hover:bg-rule"
              }
            >
              {describeDetected(t)}
            </button>
          ))}
        </div>
        {isShot(event.type) ? (
          <p className="mt-1.5 text-[13px] text-ink-faint">
            T swaps two and three. M swaps made and missed. The model cannot tell
            a two from a three yet — it always guesses two.
          </p>
        ) : null}
      </div>

      {/* shooter */}
      <div className="mb-4">
        <span className="label mb-1.5 block">
          Player {tagged ? "" : "— none tagged yet"}
        </span>
        <div className="grid gap-3 sm:grid-cols-2">
          {[home, away].map((side) => (
            <div key={side.id}>
              <p className="mb-1 flex items-center gap-2 text-[13px] font-semibold">
                <span
                  aria-hidden
                  className="size-3 rounded-[4px]"
                  style={{ backgroundColor: side.color }}
                />
                {side.name}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {slots
                  .filter((s) => s.side.id === side.id)
                  .map((slot) => {
                    const picked = slot.player.playerId === taggedId;
                    return (
                      <button
                        key={slot.player.playerId}
                        onClick={() => onTag(slot)}
                        aria-pressed={picked}
                        className={
                          picked
                            ? "flex min-h-11 items-center gap-1.5 rounded-full bg-ink px-3 text-[13px] font-semibold text-on-ink"
                            : "flex min-h-11 items-center gap-1.5 rounded-full bg-paper px-3 text-[13px] font-medium text-ink-body hover:bg-rule"
                        }
                      >
                        <span className="num opacity-60">{slot.key}</span>
                        <span className="max-w-[9rem] truncate">{slot.player.name}</span>
                        {slot.player.playerId === lastTagged && !picked ? (
                          <span className="num text-[11px] opacity-60">last</span>
                        ) : null}
                      </button>
                    );
                  })}
                {slots.filter((s) => s.side.id === side.id).length === 0 ? (
                  <p className="text-[13px] text-ink-faint">
                    No roster for this team yet.
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {event.status === "pending" ? (
          <>
            <Button variant="accent" onClick={onConfirm} disabled={busy}>
              Confirm
            </Button>
            <Button variant="quiet" onClick={onReject} disabled={busy}>
              Reject
            </Button>
          </>
        ) : (
          <Button variant="quiet" onClick={onUnreview} disabled={busy}>
            Send back to the queue
          </Button>
        )}
      </div>
      {!taggedId && event.status === "pending" ? (
        <p className="mt-2 text-sm text-ink-muted">
          Confirming without a player still puts the points on the team&rsquo;s
          score — tag someone to get it into their line.
        </p>
      ) : null}
    </section>
  );
}
