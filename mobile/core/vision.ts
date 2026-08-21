// Intramural Vision — the review-queue engine. Pure functions, no I/O, unit
// tested in vision.test.ts (BRIEF §7: logic separate from UI).
//
// The product decision this file encodes: the model proposes, a human
// disposes. Everything here exists to make a human's pass over a game's
// candidate events fast enough to be worth doing — the target is a full game
// reviewed in under five minutes, hands never leaving the keyboard.

import { SCORING_POINTS } from "./game-constants";

/** The subset of game_events types a camera can propose. Fouls, violations,
    and and-ones are not on this list on purpose — see docs/VISION.md. */
export const DETECTABLE_TYPES = [
  "fg2_made",
  "fg2_miss",
  "fg3_made",
  "fg3_miss",
  "ft_made",
  "ft_miss",
  "oreb",
  "dreb",
  "ast",
  "stl",
  "blk",
  "to",
] as const;

export type DetectedType = (typeof DETECTABLE_TYPES)[number];

export interface DetectedEvent {
  id: string;
  type: string;
  ts_ms: number;
  period: number;
  confidence: number;
  status: "pending" | "confirmed" | "rejected";
  user_id: string | null;
  guest_id: string | null;
  team_id: string | null;
  source: "model" | "manual";
}

/* ------------------------------------------------------------- confidence --
   Three bands, not a number, because a reviewer decides in a glance and a
   percentage does not help them. No green and no amber in the palette
   (DESIGN.md), so the UI renders these as ink / bench / accent. */

export type ConfidenceBand = "sure" | "check" | "shaky";

export const CONFIDENCE_BANDS = { sure: 0.85, check: 0.6 } as const;

export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= CONFIDENCE_BANDS.sure) return "sure";
  if (confidence >= CONFIDENCE_BANDS.check) return "check";
  return "shaky";
}

/* ----------------------------------------------------------------- editing --
   The v1 pipeline has no court homography, so it cannot tell a two from a
   three: it emits fg2_* and the reviewer upgrades with one key. These are the
   only two edits that matter at speed; anything else goes through the picker. */

const THREE: Record<string, string> = { fg2_made: "fg3_made", fg2_miss: "fg3_miss" };
const TWO: Record<string, string> = { fg3_made: "fg2_made", fg3_miss: "fg2_miss" };

/** Toggle a field goal between two and three. Non-shots pass through. */
export function toggleShotValue(type: string): string {
  return THREE[type] ?? TWO[type] ?? type;
}

const FLIP: Record<string, string> = {
  fg2_made: "fg2_miss",
  fg2_miss: "fg2_made",
  fg3_made: "fg3_miss",
  fg3_miss: "fg3_made",
  ft_made: "ft_miss",
  ft_miss: "ft_made",
};

/** Toggle a shot between made and missed. Non-shots pass through. */
export function toggleShotResult(type: string): string {
  return FLIP[type] ?? type;
}

export function isShot(type: string): boolean {
  return type in FLIP;
}

/** Points this event puts on the board, for the running review tally. */
export function pointsFor(type: string): number {
  return SCORING_POINTS[type] ?? 0;
}

/* -------------------------------------------------------------- candidates --
   A motion-energy detector is chatty: one shot near the rim can spike three
   times in half a second. Collapsing them here rather than in the worker means
   a re-tuned threshold does not require a re-run to clean up the queue. */

export function mergeCandidates<T extends DetectedEvent>(
  events: T[],
  windowMs = 1500,
): T[] {
  const kept: T[] = [];
  for (const e of [...events].sort((a, b) => a.ts_ms - b.ts_ms)) {
    // A human's ruling is never merged away by a neighbour.
    if (e.status !== "pending" || e.source === "manual") {
      kept.push(e);
      continue;
    }
    const near = kept.find(
      (k) =>
        k.status === "pending" &&
        k.source === "model" &&
        k.type === e.type &&
        Math.abs(k.ts_ms - e.ts_ms) < windowMs,
    );
    if (!near) {
      kept.push(e);
    } else if (e.confidence > near.confidence) {
      kept[kept.indexOf(near)] = e;
    }
  }
  return kept.sort((a, b) => a.ts_ms - b.ts_ms);
}

/* ------------------------------------------------------------------ queue --
   Shakiest first. The reviewer spends their attention where the model is
   least sure, and the tail of the queue is the part they can bulk-confirm. */

export type ReviewSort = "confidence" | "time";

export function reviewQueue<T extends DetectedEvent>(
  events: T[],
  sort: ReviewSort = "confidence",
): T[] {
  const pending = events.filter((e) => e.status === "pending");
  return pending.sort((a, b) =>
    sort === "time"
      ? a.ts_ms - b.ts_ms
      : a.confidence - b.confidence || a.ts_ms - b.ts_ms,
  );
}

/** J / K movement. Returns the neighbour's id, or null at either end. */
export function stepQueue<T extends { id: string }>(
  queue: T[],
  currentId: string | null,
  direction: 1 | -1,
): string | null {
  if (queue.length === 0) return null;
  const i = queue.findIndex((e) => e.id === currentId);
  if (i === -1) return queue[direction === 1 ? 0 : queue.length - 1].id;
  const next = i + direction;
  if (next < 0 || next >= queue.length) return null;
  return queue[next].id;
}

/** After confirming or rejecting, land on whatever slid into this slot —
    not on the next index, which would skip an event as the queue shrinks. */
export function afterDisposing<T extends { id: string }>(
  queue: T[],
  disposedId: string,
): string | null {
  const i = queue.findIndex((e) => e.id === disposedId);
  if (i === -1) return queue[0]?.id ?? null;
  const remaining = queue.filter((e) => e.id !== disposedId);
  if (remaining.length === 0) return null;
  return remaining[Math.min(i, remaining.length - 1)].id;
}

/** Everything the reviewer could clear in one keystroke: the model is
    confident AND a shooter is already attached, so confirming adds real data. */
export function bulkConfirmable<T extends DetectedEvent>(
  events: T[],
  threshold = CONFIDENCE_BANDS.sure,
): T[] {
  return events.filter(
    (e) =>
      e.status === "pending" &&
      e.source === "model" &&
      e.confidence >= threshold &&
      (e.user_id !== null || e.guest_id !== null),
  );
}

export interface ReviewProgress {
  total: number;
  pending: number;
  confirmed: number;
  rejected: number;
  /** 0..1 — reviewed over total. */
  pct: number;
  /** Rough seconds left at four seconds a call. Honest enough to pace by. */
  secondsLeft: number;
}

export const SECONDS_PER_CALL = 4;

export function reviewProgress(events: DetectedEvent[]): ReviewProgress {
  const total = events.length;
  const pending = events.filter((e) => e.status === "pending").length;
  const confirmed = events.filter((e) => e.status === "confirmed").length;
  const rejected = events.filter((e) => e.status === "rejected").length;
  return {
    total,
    pending,
    confirmed,
    rejected,
    pct: total === 0 ? 0 : (total - pending) / total,
    secondsLeft: pending * SECONDS_PER_CALL,
  };
}

/* ------------------------------------------------------------------- film --- */

/** Film clock, mm:ss or h:mm:ss. Negative and NaN clamp to zero rather than
    rendering "-1:-3" on a scrubber. */
export function formatFilmClock(ms: number): string {
  const total = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0;
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/** Selecting an event seeks to a few seconds before it — you cannot judge a
    shot from the frame it lands on. Clamped to the start of the film. */
export function seekTargetMs(tsMs: number, leadMs = 3000): number {
  return Math.max(0, tsMs - leadMs);
}

/** Scrubber position, 0..1. A zero-length film puts everything at the start
    instead of dividing by zero. */
export function markerPosition(tsMs: number, durationMs: number): number {
  if (!durationMs || durationMs <= 0) return 0;
  return Math.min(1, Math.max(0, tsMs / durationMs));
}

/* ------------------------------------------------------------ calibration --
   The rim box is stored in 0..1 of frame size, not pixels, so it survives the
   post-processing transcode to 720p (build plan §6) and a phone that records
   at a different resolution than the browser previews at. */

export interface RimRoi {
  x: number;
  y: number;
  w: number;
  h: number;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function normalizeRoi(
  box: { x: number; y: number; w: number; h: number },
  frameW: number,
  frameH: number,
): RimRoi | null {
  if (!frameW || !frameH || box.w <= 0 || box.h <= 0) return null;
  // Clamp the corners, then derive the size — clamping x and w independently
  // lets a box dragged off the right edge keep a width that runs past 1.
  const x0 = clamp01(box.x / frameW);
  const y0 = clamp01(box.y / frameH);
  const x1 = clamp01((box.x + box.w) / frameW);
  const y1 = clamp01((box.y + box.h) / frameH);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function denormalizeRoi(roi: RimRoi, frameW: number, frameH: number) {
  return {
    x: roi.x * frameW,
    y: roi.y * frameH,
    w: roi.w * frameW,
    h: roi.h * frameH,
  };
}

/** A rim box smaller than this is almost certainly a stray click, and a box
    covering most of the frame defeats the point of an ROI. */
export function roiLooksUsable(roi: RimRoi | null): boolean {
  if (!roi) return false;
  const area = roi.w * roi.h;
  return roi.w >= 0.02 && roi.h >= 0.02 && area <= 0.25;
}

/* -------------------------------------------------------------- pre-flight --
   Build plan §1: the model's ceiling is set by the footage, so these are a
   product requirement, not a suggestion. Shown as a checklist before the
   admin can queue a recording. */

export const PREFLIGHT = [
  {
    key: "fixed",
    title: "Camera is fixed and will not pan or zoom",
    body: "A pan moves the rim out of its box and the whole run is wasted. Wedge the phone or clamp it.",
  },
  {
    key: "sideline",
    title: "Mounted at the sideline, near half court",
    body: "Elevated ten to fifteen feet if there is a balcony or a bleacher top. A corner is the fallback.",
  },
  {
    key: "quality",
    title: "Recording at 1080p, 60fps",
    body: "Sixty frames matter at the rim, where the ball moves fastest.",
  },
  {
    key: "rim",
    title: "The rim you are tracking is fully in frame",
    body: "One rim is enough. Both rims in frame means you can run the film twice, once per basket.",
  },
  {
    key: "jerseys",
    title: "The two teams are in contrasting colours",
    body: "Same-colour matchups are the one thing that makes the film unusable.",
  },
  {
    key: "consent",
    title: "Nobody on either roster has revoked film consent",
    body: "Consent is recorded when a player joins the league. One revoked player blocks processing until it is re-granted on the Film page.",
  },
] as const;

/* ----------------------------------------------------------------- scanner --
   The in-browser detector. The review room plays the film fast and hidden,
   samples the rim box through a canvas, and hands the samples here. Pure and
   tested; the browser part only produces {tsMs, energy, centroidY}.

   energy    — mean absolute per-pixel difference of the greyscale rim crop
               against the previous sample, 0..1. A shot at the rim (ball in,
               net moving, ball out) spikes it well above the idle baseline.
   centroidY — energy-weighted centroid row of that difference, 0 at the top
               of the rim box, 1 at the bottom. A make drags it downward
               through the net; a front-rim brick keeps it high. */

export interface MotionSample {
  tsMs: number;
  energy: number;
  centroidY: number;
}

export interface ScanOptions {
  /** Spike = energy above baselineRatio × the median sample. */
  baselineRatio?: number;
  /** …but never below this floor, so a dead-still gym doesn't spike on noise. */
  energyFloor?: number;
  /** Spikes closer than this merge into one candidate. */
  mergeGapMs?: number;
  /** Keep only the strongest N — a threshold gone wrong must not flood the queue. */
  maxCandidates?: number;
  /** The learned make/miss line for this league's gym — see calibrateMakeMiss. */
  makeMissThreshold?: number;
}

const SCAN_DEFAULTS: Required<ScanOptions> = {
  baselineRatio: 3,
  energyFloor: 0.02,
  mergeGapMs: 1500,
  maxCandidates: 250,
  makeMissThreshold: 0.5,
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** The energy level a sample must clear to count as motion at the rim. */
export function scanThreshold(samples: MotionSample[], opts: ScanOptions = {}): number {
  const { baselineRatio, energyFloor } = { ...SCAN_DEFAULTS, ...opts };
  return Math.max(energyFloor, median(samples.map((s) => s.energy)) * baselineRatio);
}

export interface MotionWindow {
  startMs: number;
  endMs: number;
  /** Timestamp of the strongest sample — where the candidate lands. */
  peakMs: number;
  peak: number;
  samples: MotionSample[];
}

/** Group above-threshold samples into windows, merging within mergeGapMs. */
export function findMotionWindows(
  samples: MotionSample[],
  opts: ScanOptions = {},
): MotionWindow[] {
  const { mergeGapMs } = { ...SCAN_DEFAULTS, ...opts };
  const threshold = scanThreshold(samples, opts);
  const spikes = samples
    .filter((s) => s.energy >= threshold)
    .sort((a, b) => a.tsMs - b.tsMs);

  const windows: MotionWindow[] = [];
  for (const s of spikes) {
    const last = windows[windows.length - 1];
    if (last && s.tsMs - last.endMs <= mergeGapMs) {
      last.endMs = s.tsMs;
      last.samples.push(s);
      if (s.energy > last.peak) {
        last.peak = s.energy;
        last.peakMs = s.tsMs;
      }
    } else {
      windows.push({
        startMs: s.tsMs,
        endMs: s.tsMs,
        peakMs: s.tsMs,
        peak: s.energy,
        samples: [s],
      });
    }
  }
  return windows;
}

/** Made or missed, from where the motion lived in the rim box. The net hangs
    in the lower half, so a make concentrates difference-energy low; a rim-out
    keeps it high. Crude on purpose — the reviewer flips it with one key, and
    every flip becomes a labelled example that re-draws the line (see
    calibrateMakeMiss below). */
export function scoreMakeMiss(
  samples: MotionSample[],
  threshold = 0.5,
): {
  made: boolean;
  lean: number; // 0 (coin flip) .. 1 (unambiguous)
  /** Share of difference-energy in the lower half of the rim box, 0..1.
      Stored with each candidate — it is the feature calibration learns on. */
  lowerShare: number;
} {
  const total = samples.reduce((sum, s) => sum + s.energy, 0);
  if (total <= 0) return { made: false, lean: 0, lowerShare: 0 };
  const lowerShare =
    samples.reduce((sum, s) => sum + (s.centroidY >= 0.5 ? s.energy : 0), 0) / total;
  return {
    made: lowerShare >= threshold,
    lean: Math.min(1, Math.abs(lowerShare - threshold) * 2),
    lowerShare,
  };
}

/** How sure the scan is, 0..1. Grows with how far the peak cleared the
    baseline and with how decisive the make/miss lean is — and is capped
    below the bulk-confirm band, because a motion heuristic must never be
    confirmable without a human looking at it. */
export function scanConfidence(
  peak: number,
  threshold: number,
  lean: number,
): number {
  const strength = Math.tanh(Math.max(0, peak / threshold - 1));
  const c = 0.3 + 0.3 * strength + 0.2 * lean;
  return Math.min(0.8, Math.max(0.2, Math.round(c * 100) / 100));
}

/* ------------------------------------------------------------ shot features --
   Everything the motion analysis can say about one window, kept as a named
   vector and stored with every candidate. This is the training set: the
   reviewer's ruling labels each row, and the models below re-fit from the
   whole history on every visit. Numbers only — no pixels ever leave the
   scan, so the rows can outlive the film (§7: derived data is not
   biometric). */

export interface WindowFeatures {
  /** Share of difference-energy in the lower half of the rim box. */
  lowerShare: number;
  /** Energy-weighted centroid drift, after the peak minus before it —
      positive when the motion travels down through the net. */
  driftDown: number;
  /** Window length. A shot is brief; a scramble under the rim is not. */
  durationMs: number;
  /** Share of the window's energy after the peak — a make decays, a
      rim-out keeps rattling. */
  postShare: number;
  /** Peak energy over the scan threshold, ≥ 1. */
  peakRatio: number;
}

function weightedCentroid(samples: MotionSample[]): number {
  const total = samples.reduce((s, x) => s + x.energy, 0);
  if (total <= 0) return 0.5;
  return samples.reduce((s, x) => s + x.centroidY * x.energy, 0) / total;
}

export function featuresFromWindow(w: MotionWindow, threshold: number): WindowFeatures {
  const total = w.samples.reduce((s, x) => s + x.energy, 0);
  const pre = w.samples.filter((s) => s.tsMs <= w.peakMs);
  const post = w.samples.filter((s) => s.tsMs > w.peakMs);
  const postEnergy = post.reduce((s, x) => s + x.energy, 0);
  return {
    lowerShare:
      total <= 0
        ? 0
        : w.samples.reduce((s, x) => s + (x.centroidY >= 0.5 ? x.energy : 0), 0) / total,
    driftDown: post.length === 0 ? 0 : weightedCentroid(post) - weightedCentroid(pre),
    durationMs: w.endMs - w.startMs,
    postShare: total <= 0 ? 0 : postEnergy / total,
    peakRatio: threshold > 0 ? w.peak / threshold : 1,
  };
}

/* ------------------------------------------------------------- shot models --
   Two tiny logistic regressions, re-trained from scratch on every page
   visit — the weights are never stored, so there is nothing to go stale
   and nothing to migrate. Zero-init batch gradient descent: deterministic,
   dependency-free, and milliseconds at this scale.

     makeMiss — P(the shot went in), trained on confirmed shots.
     realShot — P(this window was a shot at all), trained on confirmed
                versus rejected candidates. This is what teaches the
                scanner to stop proposing the janitor's mop at the rim. */

/** Bounded, fixed-scale inputs — no per-league normalisation to drift. */
function vectorize(f: WindowFeatures): number[] {
  return [
    1,
    clamp01(f.lowerShare),
    clamp01((f.driftDown + 1) / 2),
    Math.min(f.durationMs, 4000) / 4000,
    clamp01(f.postShare),
    Math.min(Math.max(f.peakRatio, 0), 8) / 8,
  ];
}

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export interface LabelledFeatures {
  features: WindowFeatures;
  label: boolean;
}

/** A model must have seen both outcomes this many times before it rules. */
export const MODEL_MIN_PER_CLASS = 5;

export function trainShotClassifier(examples: LabelledFeatures[]): number[] | null {
  const positives = examples.filter((e) => e.label).length;
  if (positives < MODEL_MIN_PER_CLASS || examples.length - positives < MODEL_MIN_PER_CLASS) {
    return null;
  }
  const xs = examples.map((e) => vectorize(e.features));
  const ys = examples.map((e) => (e.label ? 1 : 0));
  const w = new Array<number>(xs[0].length).fill(0);
  const lr = 0.6;
  const l2 = 0.01;
  for (let epoch = 0; epoch < 400; epoch++) {
    const g = new Array<number>(w.length).fill(0);
    for (let i = 0; i < xs.length; i++) {
      const err = sigmoid(dot(w, xs[i])) - ys[i];
      for (let j = 0; j < w.length; j++) g[j] += err * xs[i][j];
    }
    for (let j = 0; j < w.length; j++) {
      // the bias term escapes the L2 pull — the base rate is not noise
      w[j] -= lr * (g[j] / xs.length + l2 * (j === 0 ? 0 : w[j]));
    }
  }
  return w.map((v) => Math.round(v * 1e4) / 1e4);
}

export function classifyShot(weights: number[], f: WindowFeatures): number {
  return sigmoid(dot(weights, vectorize(f)));
}

export interface ShotModel {
  makeMiss: number[] | null;
  realShot: number[] | null;
  /** The 1-D calibrated line — the fallback while makeMiss is null, and
      for old candidates scanned before features were stored. */
  makeMissThreshold: number;
  samples: { makeMiss: number; realShot: number; threshold: number };
}

function parseFeatures(payload: Record<string, unknown> | null): WindowFeatures | null {
  const f = payload?.features as Record<string, unknown> | undefined;
  if (!f) return null;
  const keys = ["lowerShare", "driftDown", "durationMs", "postShare", "peakRatio"] as const;
  const out = {} as Record<(typeof keys)[number], number>;
  for (const k of keys) {
    const v = f[k];
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    out[k] = v;
  }
  return out;
}

/** The whole self-teaching loop in one call: reviewed candidate rows in,
    freshly trained models out. Run it server-side before each scan. */
export function shotModelFromRows(
  rows: {
    type: string;
    status: string;
    source: string;
    payload: Record<string, unknown> | null;
  }[],
): ShotModel {
  const makeMiss: LabelledFeatures[] = [];
  const realShot: LabelledFeatures[] = [];
  for (const r of rows) {
    if (r.source !== "model") continue;
    const features = parseFeatures(r.payload);
    if (!features) continue;
    if (r.status === "confirmed" || r.status === "rejected") {
      realShot.push({ features, label: r.status === "confirmed" });
    }
    if (r.status === "confirmed" && isShot(r.type)) {
      makeMiss.push({ features, label: r.type.endsWith("_made") });
    }
  }
  const calibration = calibrateMakeMiss(makeMissExamples(rows));
  return {
    makeMiss: trainShotClassifier(makeMiss),
    realShot: trainShotClassifier(realShot),
    makeMissThreshold: calibration.threshold,
    samples: {
      makeMiss: makeMiss.length,
      realShot: realShot.length,
      threshold: calibration.samples,
    },
  };
}

export interface ScanCandidate {
  type: "fg2_made" | "fg2_miss";
  ts_ms: number;
  confidence: number;
  payload: Record<string, unknown>;
}

/** Samples in, ingestable candidates out. The whole scan pipeline. */
export function candidatesFromScan(
  samples: MotionSample[],
  opts: ScanOptions & { model?: ShotModel } = {},
): ScanCandidate[] {
  const { maxCandidates, makeMissThreshold } = { ...SCAN_DEFAULTS, ...opts };
  const model = opts.model;
  const line = model?.makeMissThreshold ?? makeMissThreshold;
  const threshold = scanThreshold(samples, opts);
  const windows = findMotionWindows(samples, opts);
  const strongest = [...windows]
    .sort((a, b) => b.peak - a.peak)
    .slice(0, maxCandidates);

  return strongest
    .sort((a, b) => a.peakMs - b.peakMs)
    .map((w) => {
      const features = featuresFromWindow(w, threshold);

      // Made or missed: the trained model rules once it exists; until then
      // the calibrated 1-D line does. Same fallback, per decision.
      let made: boolean;
      let lean: number;
      if (model?.makeMiss) {
        const p = classifyShot(model.makeMiss, features);
        made = p >= 0.5;
        lean = Math.min(1, Math.abs(2 * p - 1));
      } else {
        ({ made, lean } = scoreMakeMiss(w.samples, line));
      }

      // Was it a shot at all: the reject-trained model scales confidence
      // down for windows that look like the junk this league rejects.
      let confidence = scanConfidence(w.peak, threshold, lean);
      if (model?.realShot) {
        const pReal = classifyShot(model.realShot, features);
        confidence = Math.min(0.8, Math.max(0.2, Math.round(confidence * (0.4 + 0.6 * pReal) * 100) / 100));
      }

      const type = made ? ("fg2_made" as const) : ("fg2_miss" as const);
      const round3 = (n: number) => Math.round(n * 1000) / 1000;
      return {
        type,
        ts_ms: Math.round(w.peakMs),
        confidence,
        payload: {
          scanner: "browser-motion",
          peak_energy: round3(w.peak),
          window_ms: [Math.round(w.startMs), Math.round(w.endMs)],
          samples: w.samples.length,
          // The training row: everything the scan saw, and what it guessed.
          // The reviewer's final ruling is the truth label; the models above
          // re-fit from the whole history on every visit.
          features: {
            lowerShare: round3(features.lowerShare),
            driftDown: round3(features.driftDown),
            durationMs: Math.round(features.durationMs),
            postShare: round3(features.postShare),
            peakRatio: round3(features.peakRatio),
          },
          lower_share: round3(features.lowerShare),
          predicted: type,
        },
      };
    });
}

/* ------------------------------------------------------------- calibration --
   The self-tuning loop. Every reviewed call carries the scan's lower_share
   and the human's final ruling; this re-draws the made/missed line where the
   reviewers actually put it. A gym with a deep net reads different from a
   gym with a stiff one — the fixed 0.5 is only the day-one default. */

export interface MakeMissExample {
  lowerShare: number;
  made: boolean;
}

/** Don't move off the default until the line has this much evidence. */
export const CALIBRATION_MIN_EXAMPLES = 10;

/** The learned line stays on the chart: a run of one-sided games must not
    push it somewhere every future call comes out the same. */
export const CALIBRATION_CLAMP: readonly [number, number] = [0.3, 0.7];

/** Reviewed candidate rows → training examples. Only model-sourced calls a
    human confirmed count: the final type is the truth, the stored
    lower_share is the feature. Rejected rows are excluded — "not a shot at
    all" says nothing about made versus missed. */
export function makeMissExamples(
  rows: {
    type: string;
    status: string;
    source: string;
    payload: Record<string, unknown> | null;
  }[],
): MakeMissExample[] {
  return rows.flatMap((r) => {
    if (r.status !== "confirmed" || r.source !== "model") return [];
    if (!isShot(r.type)) return [];
    const share = r.payload?.lower_share;
    if (typeof share !== "number" || !Number.isFinite(share)) return [];
    return [{ lowerShare: share, made: r.type.endsWith("_made") }];
  });
}

export interface MakeMissCalibration {
  threshold: number;
  /** Fraction of the examples the chosen line reproduces, 0..1. */
  accuracy: number;
  samples: number;
}

export function calibrateMakeMiss(examples: MakeMissExample[]): MakeMissCalibration {
  if (examples.length < CALIBRATION_MIN_EXAMPLES) {
    return { threshold: 0.5, accuracy: 0, samples: examples.length };
  }

  const accuracyAt = (t: number) =>
    examples.filter((e) => (e.lowerShare >= t) === e.made).length / examples.length;

  // Candidate lines: midpoints between neighbouring observed values, plus
  // the default. A 1-D sweep — the feature space is tiny and exact beats
  // clever here.
  const shares = [...new Set(examples.map((e) => e.lowerShare))].sort((a, b) => a - b);
  const candidates = [0.5];
  for (let i = 1; i < shares.length; i++) {
    candidates.push((shares[i - 1] + shares[i]) / 2);
  }

  let best = 0.5;
  let bestAccuracy = accuracyAt(0.5);
  for (const t of candidates) {
    const a = accuracyAt(t);
    // Strictly better wins; a tie keeps whichever line sits closer to the
    // default, so the calibration never drifts without evidence.
    if (a > bestAccuracy || (a === bestAccuracy && Math.abs(t - 0.5) < Math.abs(best - 0.5))) {
      best = t;
      bestAccuracy = a;
    }
  }

  const [lo, hi] = CALIBRATION_CLAMP;
  const threshold = Math.min(hi, Math.max(lo, best));
  return {
    threshold: Math.round(threshold * 1000) / 1000,
    accuracy: Math.round(accuracyAt(threshold) * 1000) / 1000,
    samples: examples.length,
  };
}

/* --------------------------------------------------------------- language -- */

const PHRASE: Record<string, string> = {
  fg2_made: "Made two",
  fg2_miss: "Missed two",
  fg3_made: "Made three",
  fg3_miss: "Missed three",
  ft_made: "Made free throw",
  ft_miss: "Missed free throw",
  oreb: "Offensive rebound",
  dreb: "Defensive rebound",
  ast: "Assist",
  stl: "Steal",
  blk: "Block",
  to: "Turnover",
  pf: "Foul",
  tf: "Technical",
};

export function describeDetected(type: string): string {
  return PHRASE[type] ?? type;
}
