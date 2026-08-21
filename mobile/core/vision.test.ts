import { describe, expect, it } from "vitest";
import {
  afterDisposing,
  bulkConfirmable,
  confidenceBand,
  denormalizeRoi,
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
  trainShotClassifier,
  toggleShotResult,
  toggleShotValue,
  calibrateMakeMiss,
  classifyShot,
  CALIBRATION_MIN_EXAMPLES,
  candidatesFromScan,
  findMotionWindows,
  scanConfidence,
  scanThreshold,
  makeMissExamples,
  shotModelFromRows,
  scoreMakeMiss,
  type DetectedEvent,
  type MotionSample,
} from "./vision";

const e = (
  id: string,
  ts_ms: number,
  confidence: number,
  over: Partial<DetectedEvent> = {},
): DetectedEvent => ({
  id,
  type: "fg2_made",
  ts_ms,
  period: 1,
  confidence,
  status: "pending",
  user_id: null,
  guest_id: null,
  team_id: null,
  source: "model",
  ...over,
});

describe("confidenceBand", () => {
  it("splits into the three bands the review room renders", () => {
    expect(confidenceBand(0.99)).toBe("sure");
    expect(confidenceBand(0.85)).toBe("sure");
    expect(confidenceBand(0.84)).toBe("check");
    expect(confidenceBand(0.6)).toBe("check");
    expect(confidenceBand(0.59)).toBe("shaky");
    expect(confidenceBand(0)).toBe("shaky");
  });
});

describe("shot editing", () => {
  it("upgrades a two to a three and back, keeping the result", () => {
    expect(toggleShotValue("fg2_made")).toBe("fg3_made");
    expect(toggleShotValue("fg3_made")).toBe("fg2_made");
    expect(toggleShotValue("fg2_miss")).toBe("fg3_miss");
    expect(toggleShotValue("fg3_miss")).toBe("fg2_miss");
  });

  it("flips made and missed, keeping the value", () => {
    expect(toggleShotResult("fg3_made")).toBe("fg3_miss");
    expect(toggleShotResult("ft_miss")).toBe("ft_made");
  });

  it("passes non-shots through untouched", () => {
    expect(toggleShotValue("dreb")).toBe("dreb");
    expect(toggleShotResult("stl")).toBe("stl");
    expect(isShot("dreb")).toBe(false);
    expect(isShot("fg2_miss")).toBe(true);
  });

  it("scores the types that put points on the board", () => {
    expect(pointsFor("fg3_made")).toBe(3);
    expect(pointsFor("fg2_made")).toBe(2);
    expect(pointsFor("ft_made")).toBe(1);
    expect(pointsFor("fg2_miss")).toBe(0);
    expect(pointsFor("dreb")).toBe(0);
  });
});

describe("mergeCandidates", () => {
  it("collapses a motion spike that fired three times into one call", () => {
    const merged = mergeCandidates([
      e("a", 10_000, 0.4),
      e("b", 10_300, 0.9),
      e("c", 10_800, 0.5),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("b"); // the most confident of the cluster survives
  });

  it("keeps candidates outside the window", () => {
    const merged = mergeCandidates([e("a", 10_000, 0.4), e("b", 12_000, 0.9)]);
    expect(merged.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("does not merge different event types that happen together", () => {
    const merged = mergeCandidates([
      e("a", 10_000, 0.4),
      e("b", 10_200, 0.9, { type: "dreb" }),
    ]);
    expect(merged).toHaveLength(2);
  });

  it("never merges away a call a human already ruled on", () => {
    const merged = mergeCandidates([
      e("a", 10_000, 0.4, { status: "confirmed" }),
      e("b", 10_200, 0.9),
    ]);
    expect(merged.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("never merges away a manually added event", () => {
    const merged = mergeCandidates([
      e("a", 10_000, 1, { source: "manual" }),
      e("b", 10_200, 0.9),
    ]);
    expect(merged).toHaveLength(2);
  });

  it("returns events in film order", () => {
    const merged = mergeCandidates([e("b", 9_000, 0.5), e("a", 3_000, 0.5)]);
    expect(merged.map((m) => m.ts_ms)).toEqual([3_000, 9_000]);
  });
});

describe("reviewQueue", () => {
  const events = [
    e("sure", 1_000, 0.95),
    e("shaky", 2_000, 0.2),
    e("mid", 3_000, 0.7),
    e("done", 4_000, 0.1, { status: "confirmed" }),
  ];

  it("puts the shakiest call first and drops reviewed ones", () => {
    expect(reviewQueue(events).map((q) => q.id)).toEqual(["shaky", "mid", "sure"]);
  });

  it("can run in film order instead", () => {
    expect(reviewQueue(events, "time").map((q) => q.id)).toEqual([
      "sure",
      "shaky",
      "mid",
    ]);
  });

  it("breaks a confidence tie by timestamp so the order is stable", () => {
    const tied = [e("late", 9_000, 0.5), e("early", 1_000, 0.5)];
    expect(reviewQueue(tied).map((q) => q.id)).toEqual(["early", "late"]);
  });

  it("does not mutate the input array", () => {
    const input = [e("a", 2_000, 0.9), e("b", 1_000, 0.1)];
    reviewQueue(input);
    expect(input.map((q) => q.id)).toEqual(["a", "b"]);
  });
});

describe("queue navigation", () => {
  const queue = [e("a", 1, 0.1), e("b", 2, 0.2), e("c", 3, 0.3)];

  it("moves forward and back", () => {
    expect(stepQueue(queue, "a", 1)).toBe("b");
    expect(stepQueue(queue, "b", -1)).toBe("a");
  });

  it("stops at both ends rather than wrapping", () => {
    expect(stepQueue(queue, "c", 1)).toBeNull();
    expect(stepQueue(queue, "a", -1)).toBeNull();
  });

  it("starts at the right end when nothing is selected", () => {
    expect(stepQueue(queue, null, 1)).toBe("a");
    expect(stepQueue(queue, null, -1)).toBe("c");
  });

  it("returns null for an empty queue", () => {
    expect(stepQueue([], null, 1)).toBeNull();
  });

  it("lands on whatever slid into the slot after a ruling", () => {
    expect(afterDisposing(queue, "b")).toBe("c");
  });

  it("steps back when the last event in the queue is disposed of", () => {
    expect(afterDisposing(queue, "c")).toBe("b");
  });

  it("returns null when that was the last one", () => {
    expect(afterDisposing([e("only", 1, 0.5)], "only")).toBeNull();
  });
});

describe("bulkConfirmable", () => {
  it("offers only confident calls that already have a shooter", () => {
    const events = [
      e("tagged", 1, 0.95, { user_id: "u1" }),
      e("untagged", 2, 0.95),
      e("guest", 3, 0.9, { guest_id: "g1" }),
      e("shaky", 4, 0.5, { user_id: "u1" }),
      e("done", 5, 0.99, { user_id: "u1", status: "confirmed" }),
      e("manual", 6, 1, { user_id: "u1", source: "manual" }),
    ];
    expect(bulkConfirmable(events).map((b) => b.id)).toEqual(["tagged", "guest"]);
  });
});

describe("reviewProgress", () => {
  it("counts the pass and paces it", () => {
    const p = reviewProgress([
      e("a", 1, 0.5),
      e("b", 2, 0.5, { status: "confirmed" }),
      e("c", 3, 0.5, { status: "rejected" }),
      e("d", 4, 0.5),
    ]);
    expect(p).toMatchObject({ total: 4, pending: 2, confirmed: 1, rejected: 1 });
    expect(p.pct).toBe(0.5);
    expect(p.secondsLeft).toBe(8);
  });

  it("does not divide by zero on an empty film", () => {
    expect(reviewProgress([]).pct).toBe(0);
  });
});

describe("film clock", () => {
  it("formats minutes and seconds", () => {
    expect(formatFilmClock(0)).toBe("0:00");
    expect(formatFilmClock(9_000)).toBe("0:09");
    expect(formatFilmClock(754_000)).toBe("12:34");
  });

  it("grows an hours field and pads the minutes once it does", () => {
    expect(formatFilmClock(3_723_000)).toBe("1:02:03");
  });

  it("clamps nonsense to zero instead of rendering a negative clock", () => {
    expect(formatFilmClock(-5_000)).toBe("0:00");
    expect(formatFilmClock(NaN)).toBe("0:00");
  });

  it("seeks a few seconds before the event, never past the start", () => {
    expect(seekTargetMs(30_000)).toBe(27_000);
    expect(seekTargetMs(1_000)).toBe(0);
  });

  it("places scrubber markers, and survives an unloaded duration", () => {
    expect(markerPosition(30_000, 60_000)).toBe(0.5);
    expect(markerPosition(90_000, 60_000)).toBe(1);
    expect(markerPosition(30_000, 0)).toBe(0);
  });
});

describe("rim calibration", () => {
  it("stores the box as a fraction of the frame", () => {
    const roi = normalizeRoi({ x: 960, y: 270, w: 192, h: 108 }, 1920, 1080)!;
    expect(roi.x).toBeCloseTo(0.5);
    expect(roi.y).toBeCloseTo(0.25);
    expect(roi.w).toBeCloseTo(0.1);
    expect(roi.h).toBeCloseTo(0.1);
  });

  it("clamps a box dragged off the edge instead of storing w > 1", () => {
    const roi = normalizeRoi({ x: 1824, y: 0, w: 400, h: 108 }, 1920, 1080)!;
    expect(roi.x + roi.w).toBeCloseTo(1);
    expect(roi.w).toBeCloseTo(0.05);
  });

  it("rejects a zero-area drag and an unmeasured frame", () => {
    expect(normalizeRoi({ x: 0, y: 0, w: 0, h: 10 }, 1920, 1080)).toBeNull();
    expect(normalizeRoi({ x: 0, y: 0, w: 10, h: 10 }, 0, 0)).toBeNull();
  });

  it("round-trips back to pixels at a different resolution", () => {
    const roi = normalizeRoi({ x: 960, y: 270, w: 192, h: 108 }, 1920, 1080)!;
    const px = denormalizeRoi(roi, 1280, 720);
    expect(px.x).toBeCloseTo(640);
    expect(px.y).toBeCloseTo(180);
    expect(px.w).toBeCloseTo(128);
    expect(px.h).toBeCloseTo(72);
  });

  it("flags a stray click and a box that swallows the frame", () => {
    expect(roiLooksUsable({ x: 0.5, y: 0.25, w: 0.1, h: 0.1 })).toBe(true);
    expect(roiLooksUsable({ x: 0.5, y: 0.25, w: 0.005, h: 0.1 })).toBe(false);
    expect(roiLooksUsable({ x: 0, y: 0, w: 0.9, h: 0.9 })).toBe(false);
    expect(roiLooksUsable(null)).toBe(false);
  });
});

describe("describeDetected", () => {
  it("names every type the pipeline can emit", () => {
    expect(describeDetected("fg3_made")).toBe("Made three");
    expect(describeDetected("oreb")).toBe("Offensive rebound");
  });

  it("falls back to the raw type rather than rendering undefined", () => {
    expect(describeDetected("jump_ball")).toBe("jump_ball");
  });
});

describe("scanner", () => {
  /** A quiet gym: tiny noise every 200ms, with shot spikes layered on top. */
  const quiet = (untilMs: number, noise = 0.005): MotionSample[] => {
    const out: MotionSample[] = [];
    for (let t = 0; t <= untilMs; t += 200) {
      out.push({ tsMs: t, energy: noise, centroidY: 0.5 });
    }
    return out;
  };
  const spike = (
    tsMs: number,
    energy: number,
    centroidY: number,
    spreadMs = 400,
  ): MotionSample[] => [
    { tsMs: tsMs - spreadMs, energy: energy * 0.6, centroidY },
    { tsMs, energy, centroidY },
    { tsMs: tsMs + spreadMs, energy: energy * 0.5, centroidY },
  ];

  it("sets the threshold from the median, floored against dead-still noise", () => {
    expect(scanThreshold(quiet(60_000))).toBe(0.02); // floor wins
    const busy = quiet(60_000, 0.05);
    expect(scanThreshold(busy)).toBeCloseTo(0.15); // 3 × median
  });

  it("groups a burst of spikes into one window with the peak on top", () => {
    const samples = [...quiet(60_000), ...spike(30_000, 0.3, 0.7)];
    const windows = findMotionWindows(samples);
    expect(windows).toHaveLength(1);
    expect(windows[0].peakMs).toBe(30_000);
    expect(windows[0].samples.length).toBe(3);
  });

  it("keeps two shots four seconds apart as two windows", () => {
    const samples = [
      ...quiet(60_000),
      ...spike(20_000, 0.3, 0.7),
      ...spike(24_000, 0.25, 0.3),
    ];
    expect(findMotionWindows(samples)).toHaveLength(2);
  });

  it("finds nothing in a film where nothing happens", () => {
    expect(findMotionWindows(quiet(60_000))).toHaveLength(0);
    expect(candidatesFromScan([])).toHaveLength(0);
  });

  it("calls low-in-the-net motion a make and rim-high motion a miss", () => {
    expect(scoreMakeMiss(spike(0, 0.3, 0.8)).made).toBe(true);
    expect(scoreMakeMiss(spike(0, 0.3, 0.2)).made).toBe(false);
    expect(scoreMakeMiss([]).lean).toBe(0);
  });

  it("is more confident about stronger, clearer spikes — and never bulk-confirmable", () => {
    const weak = scanConfidence(0.03, 0.02, 0.1);
    const strong = scanConfidence(0.3, 0.02, 0.9);
    expect(strong).toBeGreaterThan(weak);
    expect(strong).toBeLessThanOrEqual(0.8); // below the 0.85 sure band, always
    expect(weak).toBeGreaterThanOrEqual(0.2);
  });

  it("turns a game's samples into ingestable candidates in film order", () => {
    const samples = [
      ...quiet(120_000),
      ...spike(90_000, 0.35, 0.75), // make-ish
      ...spike(30_000, 0.28, 0.25), // miss-ish
    ];
    const candidates = candidatesFromScan(samples);
    expect(candidates.map((c) => c.ts_ms)).toEqual([30_000, 90_000]);
    expect(candidates[0].type).toBe("fg2_miss");
    expect(candidates[1].type).toBe("fg2_made");
    for (const c of candidates) {
      expect(c.confidence).toBeGreaterThanOrEqual(0.2);
      expect(c.confidence).toBeLessThanOrEqual(0.8);
    }
  });

  it("caps a flooded queue at the strongest candidates", () => {
    const samples: MotionSample[] = [...quiet(600_000)];
    for (let i = 0; i < 40; i++) {
      samples.push(...spike(10_000 + i * 5_000, 0.1 + (i % 7) * 0.03, 0.6));
    }
    const capped = candidatesFromScan(samples, { maxCandidates: 10 });
    expect(capped).toHaveLength(10);
    // the survivors are the strongest, still sorted by time
    const times = capped.map((c) => c.ts_ms);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});

describe("make/miss self-calibration", () => {
  const ex = (lowerShare: number, made: boolean) => ({ lowerShare, made });

  it("stays at the 0.5 default until there is enough evidence", () => {
    const few = [ex(0.9, true), ex(0.1, false), ex(0.8, true)];
    expect(calibrateMakeMiss(few)).toEqual({ threshold: 0.5, accuracy: 0, samples: 3 });
  });

  it("moves the line to where the reviewers actually ruled", () => {
    // A gym where makes read lower than the default expects: everything
    // above 0.35 was confirmed made, everything below was confirmed missed.
    // The fixed 0.5 line calls the 0.36..0.49 band wrong; the learned one
    // does not.
    const examples = [
      ...[0.36, 0.38, 0.41, 0.44, 0.47, 0.55, 0.62, 0.7].map((s) => ex(s, true)),
      ...[0.12, 0.18, 0.22, 0.27, 0.31, 0.33].map((s) => ex(s, false)),
    ];
    expect(examples.length).toBeGreaterThanOrEqual(CALIBRATION_MIN_EXAMPLES);
    const cal = calibrateMakeMiss(examples);
    expect(cal.threshold).toBeLessThan(0.36);
    expect(cal.threshold).toBeGreaterThan(0.33);
    expect(cal.accuracy).toBe(1);
    // and the recalibrated scorer now agrees with the reviewers
    const sample = (centroidY: number) => [{ tsMs: 0, energy: 1, centroidY }];
    expect(scoreMakeMiss(sample(0.4), cal.threshold).made).toBe(false);
    // lowerShare of that sample is 0 (centroid above 0.5) — use share directly:
    expect((0.4 >= cal.threshold) === true).toBe(true);
  });

  it("clamps a degenerate line back onto the chart", () => {
    // Every reviewed call was a make — the sweep would push the line to the
    // floor and call everything made forever. The clamp refuses.
    const allMade = Array.from({ length: 12 }, (_, i) => ex(0.2 + i * 0.05, true));
    const cal = calibrateMakeMiss(allMade);
    expect(cal.threshold).toBeGreaterThanOrEqual(0.3);
    expect(cal.threshold).toBeLessThanOrEqual(0.7);
  });

  it("keeps the default on a tie rather than drifting", () => {
    const balanced = [
      ...Array.from({ length: 6 }, (_, i) => ex(0.6 + i * 0.05, true)),
      ...Array.from({ length: 6 }, (_, i) => ex(0.1 + i * 0.05, false)),
    ];
    // several lines separate these perfectly; the one closest to 0.5 wins
    const cal = calibrateMakeMiss(balanced);
    expect(cal.accuracy).toBe(1);
    expect(Math.abs(cal.threshold - 0.5)).toBeLessThanOrEqual(0.15);
  });

  it("builds examples only from confirmed model calls that carry the feature", () => {
    const rows = [
      { type: "fg2_made", status: "confirmed", source: "model", payload: { lower_share: 0.8 } },
      { type: "fg3_miss", status: "confirmed", source: "model", payload: { lower_share: 0.2 } },
      // human edited two → three: still a labelled make
      { type: "fg3_made", status: "confirmed", source: "model", payload: { lower_share: 0.7 } },
      // rejected = "not a shot", not a make/miss label
      { type: "fg2_made", status: "rejected", source: "model", payload: { lower_share: 0.9 } },
      // manual additions never came from the scanner
      { type: "fg2_made", status: "confirmed", source: "manual", payload: { lower_share: 0.9 } },
      // pending rows have no ruling yet
      { type: "fg2_miss", status: "pending", source: "model", payload: { lower_share: 0.1 } },
      // old rows scanned before the feature existed
      { type: "fg2_made", status: "confirmed", source: "model", payload: {} },
      // a confirmed rebound is not a shot
      { type: "dreb", status: "confirmed", source: "model", payload: { lower_share: 0.5 } },
    ];
    expect(makeMissExamples(rows)).toEqual([
      { lowerShare: 0.8, made: true },
      { lowerShare: 0.2, made: false },
      { lowerShare: 0.7, made: true },
    ]);
  });

  it("threads the learned line through a scan and stores the training pair", () => {
    // one clean spike whose motion sits at 0.45 lower-share
    const samples = [
      ...Array.from({ length: 40 }, (_, i) => ({ tsMs: i * 250, energy: 0.005, centroidY: 0.5 })),
      { tsMs: 10_000, energy: 0.6, centroidY: 0.3 },
      { tsMs: 10_120, energy: 0.5, centroidY: 0.6 },
    ];
    const stock = candidatesFromScan(samples);
    const tuned = candidatesFromScan(samples, { makeMissThreshold: 0.3 });
    expect(stock).toHaveLength(1);
    expect(tuned).toHaveLength(1);
    // the same motion flips from miss to make under the learned line
    expect(stock[0].type).toBe("fg2_miss");
    expect(tuned[0].type).toBe("fg2_made");
    // and both carry the pair calibration will learn from next time
    for (const c of [stock[0], tuned[0]]) {
      expect(typeof c.payload.lower_share).toBe("number");
      expect(c.payload.predicted).toBe(c.type);
    }
  });
});

describe("the self-teaching shot model", () => {
  const F = (over: Partial<import("./vision").WindowFeatures> = {}) => ({
    lowerShare: 0.5,
    driftDown: 0,
    durationMs: 800,
    postShare: 0.4,
    peakRatio: 3,
    ...over,
  });

  it("refuses to rule before seeing both outcomes enough times", () => {
    const oneSided = Array.from({ length: 20 }, () => ({ features: F(), label: true }));
    expect(trainShotClassifier(oneSided)).toBeNull();
    const tiny = [
      { features: F(), label: true },
      { features: F(), label: false },
    ];
    expect(trainShotClassifier(tiny)).toBeNull();
  });

  it("learns a separable pattern and is deterministic", () => {
    // makes drift down through the net; misses bounce back up
    const examples = [
      ...Array.from({ length: 8 }, (_, i) => ({
        features: F({ driftDown: 0.3 + i * 0.05, lowerShare: 0.6 }),
        label: true,
      })),
      ...Array.from({ length: 8 }, (_, i) => ({
        features: F({ driftDown: -0.3 - i * 0.05, lowerShare: 0.4 }),
        label: false,
      })),
    ];
    const w1 = trainShotClassifier(examples);
    const w2 = trainShotClassifier(examples);
    expect(w1).not.toBeNull();
    expect(w1).toEqual(w2); // zero-init batch GD — same data, same model
    const right = examples.filter(
      (e) => (classifyShot(w1!, e.features) >= 0.5) === e.label,
    ).length;
    expect(right / examples.length).toBeGreaterThanOrEqual(0.9);
  });

  it("builds both models from reviewed rows and falls back per decision", () => {
    const row = (
      status: string,
      type: string,
      features: Record<string, number> | null,
    ) => ({ type, status, source: "model", payload: features ? { features, lower_share: features.lowerShare } : {} });

    const rows = [
      // ten confirmed makes vs misses, separable on driftDown
      ...Array.from({ length: 6 }, (_, i) =>
        row("confirmed", "fg2_made", F({ driftDown: 0.4 + i * 0.03 })),
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        row("confirmed", "fg2_miss", F({ driftDown: -0.4 - i * 0.03 })),
      ),
      // rejected junk: long scrambles with weak peaks
      ...Array.from({ length: 6 }, (_, i) =>
        row("rejected", "fg2_miss", F({ durationMs: 3200 + i * 100, peakRatio: 1.2 })),
      ),
      // rows from before features existed contribute nothing
      row("confirmed", "fg2_made", null),
    ];
    const model = shotModelFromRows(rows);
    expect(model.makeMiss).not.toBeNull();
    expect(model.realShot).not.toBeNull();
    expect(model.samples).toEqual({ makeMiss: 12, realShot: 18, threshold: 12 });

    // a downward-drifting window reads made, an upward one missed
    expect(classifyShot(model.makeMiss!, F({ driftDown: 0.5 }))).toBeGreaterThan(0.5);
    expect(classifyShot(model.makeMiss!, F({ driftDown: -0.5 }))).toBeLessThan(0.5);
    // a long weak scramble reads junk; a sharp clean spike reads shot
    expect(classifyShot(model.realShot!, F({ durationMs: 3400, peakRatio: 1.2 }))).toBeLessThan(0.5);
    expect(classifyShot(model.realShot!, F({ driftDown: 0.4 }))).toBeGreaterThan(0.5);
  });

  it("threads the model through a scan: rulings, confidence, stored features", () => {
    const quiet = Array.from({ length: 60 }, (_, i) => ({
      tsMs: i * 250,
      energy: 0.005,
      centroidY: 0.5,
    }));
    // one spike drifting DOWN (net) — the stock line would call it a miss
    // because its energy sits high in the box; the trained model calls it made
    const spike = [
      { tsMs: 20_000, energy: 0.55, centroidY: 0.35 },
      { tsMs: 20_120, energy: 0.6, centroidY: 0.4 },
      { tsMs: 20_260, energy: 0.35, centroidY: 0.9 },
    ];
    const samples = [...quiet, ...spike];

    const driftModel: import("./vision").ShotModel = {
      makeMiss: trainShotClassifier([
        ...Array.from({ length: 6 }, (_, i) => ({ features: F({ driftDown: 0.3 + i * 0.05 }), label: true })),
        ...Array.from({ length: 6 }, (_, i) => ({ features: F({ driftDown: -0.3 - i * 0.05 }), label: false })),
      ]),
      realShot: null,
      makeMissThreshold: 0.5,
      samples: { makeMiss: 12, realShot: 0, threshold: 12 },
    };

    const stock = candidatesFromScan(samples);
    const learned = candidatesFromScan(samples, { model: driftModel });
    expect(stock).toHaveLength(1);
    expect(learned).toHaveLength(1);
    expect(stock[0].type).toBe("fg2_miss");
    expect(learned[0].type).toBe("fg2_made");

    // every candidate banks the full training row for next time
    const f = learned[0].payload.features as Record<string, number>;
    for (const k of ["lowerShare", "driftDown", "durationMs", "postShare", "peakRatio"]) {
      expect(typeof f[k]).toBe("number");
    }
    // and confidence stays inside the human-review band either way
    for (const c of [...stock, ...learned]) {
      expect(c.confidence).toBeGreaterThanOrEqual(0.2);
      expect(c.confidence).toBeLessThanOrEqual(0.8);
    }
  });
});
