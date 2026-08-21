"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, FormError, FormNotice } from "@/components/ui";
import type { RecordingRow } from "@core/types";
import {
  candidatesFromScan,
  denormalizeRoi,
  type MotionSample,
  type ShotModel,
} from "@core/vision";
import { beginScan, ingestScanEvents, reportScanProgress } from "../actions";

/* The in-browser detector. No GPU, no worker, no deploy: a hidden <video>
   plays the film muted at 8× while a canvas samples the rim box a few times
   per film-second. Frame-differencing inside that box finds the moments a
   ball meets the rim; the pure functions in @core/vision turn the samples
   into candidates; the same ingest RPC a GPU worker would call puts them in
   the review queue. A 40-minute game scans in about 5 minutes in the tab. */

const SCAN_RATE = 8;
const SAMPLE_SIZE = 96; // rim crop downscaled to 96×96 grey — plenty for motion

interface ScanState {
  phase: "idle" | "starting" | "scanning" | "ingesting" | "done" | "failed";
  /** 0..1 through the film. */
  progress: number;
  found: number;
  message: string | null;
}

const IDLE: ScanState = { phase: "idle", progress: 0, found: 0, message: null };

export function ScanPanel({
  slug,
  recording,
  filmUrl,
  hasPending,
  model,
}: {
  slug: string;
  recording: RecordingRow;
  filmUrl: string | null;
  hasPending: boolean;
  /** The league's models, re-trained from every reviewed call on the server
      each time this page renders. Nulls until there is enough evidence. */
  model: ShotModel;
}) {
  const router = useRouter();
  const [state, setState] = useState<ScanState>(IDLE);
  const cancelRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Tear the hidden video down if the admin navigates away mid-scan.
  useEffect(
    () => () => {
      cancelRef.current = true;
      videoRef.current?.pause();
      videoRef.current?.removeAttribute("src");
    },
    [],
  );

  const ready = Boolean(filmUrl && recording.rim_roi);
  const scanning = state.phase === "starting" || state.phase === "scanning" || state.phase === "ingesting";

  async function start() {
    if (!filmUrl || !recording.rim_roi) return;
    cancelRef.current = false;
    setState({ phase: "starting", progress: 0, found: 0, message: null });

    // The consent gate fires here — one revoked player and this returns the
    // error that names them.
    const gate = await beginScan(slug, recording.id);
    if (gate.error) {
      setState({ ...IDLE, phase: "failed", message: gate.error });
      return;
    }

    try {
      void reportScanProgress(recording.id, "decode", 0);
      const samples = await scanFilm({
        src: filmUrl,
        roi: recording.rim_roi,
        videoRef,
        cancelRef,
        onProgress: (progress, found) =>
          setState((s) => ({ ...s, phase: "scanning", progress, found })),
      });
      if (cancelRef.current) {
        void reportScanProgress(recording.id, "detect", 0, "failed", "Scan cancelled in the browser.");
        setState(IDLE);
        return;
      }

      const candidates = candidatesFromScan(samples, { model });
      setState((s) => ({ ...s, phase: "ingesting", found: candidates.length }));
      const res = await ingestScanEvents(slug, recording.id, candidates);
      if (res.error) throw new Error(res.error);

      setState({
        phase: "done",
        progress: 1,
        found: res.count ?? candidates.length,
        message:
          (res.count ?? 0) > 0
            ? `Found ${res.count} moment${res.count === 1 ? "" : "s"} at the rim. They are in the queue, shakiest first.`
            : "The scan finished but found nothing at the rim. Check the rim box is on the hoop, then rescan.",
      });
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "The scan failed. Reload and try again.";
      void reportScanProgress(recording.id, "detect", 0, "failed", message);
      setState({ ...IDLE, phase: "failed", message });
    }
  }

  return (
    <section className="card p-5">
      <h3 className="mb-1 text-[17px] font-semibold">Scan the film</h3>
      <p className="mb-3 text-sm text-ink-muted">
        Watches the rim box for the moments a ball meets the rim and queues
        each one as a call to review. Runs right here in the browser — keep
        this tab open and visible while it works.
      </p>
      {model.makeMiss || model.realShot ? (
        <p className="mb-3 text-sm text-ink-faint">
          Running your league&apos;s own trained model —{" "}
          <span className="num">{model.samples.realShot}</span> rulings on what
          counts as a shot,{" "}
          <span className="num">{model.samples.makeMiss}</span> on made versus
          missed. Every review sharpens the next scan.
        </p>
      ) : model.makeMissThreshold !== 0.5 ? (
        <p className="mb-3 text-sm text-ink-faint">
          Made/missed line tuned from{" "}
          <span className="num">{model.samples.threshold}</span> of your
          reviewed calls — every correction sharpens the next scan.
        </p>
      ) : null}

      {state.phase === "failed" ? <FormError message={state.message} /> : null}
      {state.phase === "done" ? <FormNotice message={state.message} /> : null}

      {scanning ? (
        <div className="space-y-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-tint">
            <div
              className="h-full rounded-full bg-accent transition-[width]"
              style={{ width: `${Math.round(state.progress * 100)}%` }}
            />
          </div>
          <div className="flex items-baseline justify-between text-sm text-ink-muted">
            <span>
              {state.phase === "ingesting"
                ? "Writing the queue…"
                : `Scanning at ${SCAN_RATE}× — ${Math.round(state.progress * 100)}%`}
            </span>
            <span className="num">{state.found} spikes</span>
          </div>
          <Button
            variant="quiet"
            onClick={() => {
              cancelRef.current = true;
              videoRef.current?.pause();
            }}
          >
            Cancel scan
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {/* One red button per view: the scan owns it only while there is
              nothing to review — once calls exist, Confirm is the red one. */}
          <Button
            variant={ready && !hasPending ? "accent" : "primary"}
            onClick={start}
            disabled={!ready}
          >
            {hasPending ? "Rescan the film" : "Scan for shots"}
          </Button>
          {!ready ? (
            <p className="text-sm text-ink-muted">
              {!filmUrl
                ? "The video is gone, so there is nothing to scan."
                : "Draw the rim box on the video first — the scanner watches that box."}
            </p>
          ) : hasPending ? (
            <p className="text-sm text-ink-muted">
              Rescanning replaces the unreviewed calls. Everything you already
              confirmed or rejected stays.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------- the engine -- */

function scanFilm({
  src,
  roi,
  videoRef,
  cancelRef,
  onProgress,
}: {
  src: string;
  roi: { x: number; y: number; w: number; h: number };
  videoRef: React.RefObject<HTMLVideoElement | null>;
  cancelRef: React.RefObject<boolean>;
  onProgress: (progress: number, spikes: number) => void;
}): Promise<MotionSample[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    videoRef.current = video;
    // Supabase Storage serves signed URLs with open CORS, which is what lets
    // the canvas read frames back. Without it getImageData throws below.
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.preload = "auto";
    video.playsInline = true;

    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return reject(new Error("This browser cannot read video frames."));

    const samples: MotionSample[] = [];
    let prev: Uint8ClampedArray | null = null;
    let spikes = 0;
    let lastReport = 0;
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      video.pause();
      video.removeAttribute("src");
      resolve(samples);
    };
    const fail = (err: Error) => {
      if (finished) return;
      finished = true;
      video.pause();
      video.removeAttribute("src");
      reject(err);
    };

    const sample = () => {
      if (finished) return;
      if (cancelRef.current) return finish();
      const { videoWidth: vw, videoHeight: vh, duration } = video;
      if (vw && vh && video.currentTime > 0) {
        const box = denormalizeRoi(roi, vw, vh);
        ctx.drawImage(video, box.x, box.y, box.w, box.h, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        let data: Uint8ClampedArray;
        try {
          data = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
        } catch {
          return fail(
            new Error(
              "The browser was not allowed to read frames from storage (CORS). Check the film bucket's CORS settings, then rescan.",
            ),
          );
        }

        // greyscale diff against the previous sample: energy + row centroid
        const grey = new Uint8ClampedArray(SAMPLE_SIZE * SAMPLE_SIZE);
        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
          grey[p] = (data[i] + data[i + 1] + data[i + 2]) / 3;
        }
        if (prev) {
          let total = 0;
          let weightedRow = 0;
          for (let p = 0; p < grey.length; p++) {
            const d = Math.abs(grey[p] - prev[p]);
            total += d;
            weightedRow += d * Math.floor(p / SAMPLE_SIZE);
          }
          const energy = total / grey.length / 255;
          samples.push({
            tsMs: video.currentTime * 1000,
            energy,
            centroidY: total > 0 ? weightedRow / total / SAMPLE_SIZE : 0.5,
          });
        }
        prev = grey;

        if (duration && video.currentTime - lastReport > 2) {
          lastReport = video.currentTime;
          // a live spike count keeps the wait honest without recomputing much
          spikes = samples.filter((s) => s.energy > 0.05).length;
          onProgress(video.currentTime / duration, spikes);
        }
      }
      schedule();
    };

    const schedule = () => {
      if (finished) return;
      if (typeof video.requestVideoFrameCallback === "function")
        video.requestVideoFrameCallback(sample);
      else setTimeout(sample, 60);
    };

    video.onended = finish;
    video.onerror = () =>
      fail(new Error("The film could not be decoded in this browser. Try Chrome, or re-export the video as H.264 MP4."));
    video.onloadedmetadata = () => {
      video.playbackRate = SCAN_RATE;
      video
        .play()
        .then(schedule)
        .catch(() => fail(new Error("The browser refused to start playback. Click the page once, then rescan.")));
    };
    video.src = src;
  });
}
