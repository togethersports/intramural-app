# Intramural Vision — camera to box score

Two plans landed for this: a full build plan (Modal, YOLO11, re-ID, homography,
live mode) and a two-weekend sprint (rim ROI, pretrained detector, manual
shooter tagging). They agree on the two things that matter, and this is what
got built first.

**They agree the product is assisted, not autonomous.** The model proposes
candidate events with a timestamp and a confidence; a human confirms, edits, or
rejects each one. Useful at 70% accuracy, which is reachable — autonomous needs
97%, which is a research problem. Every correction is a labelled example, so
accuracy compounds. And it degrades gracefully: if a model run is garbage, the
courtside live console still works.

**They agree the review screen is the product.** "Optimize this screen for
speed above everything else." So that is what phase V0 is: the whole path from
consent through a reviewed box score, with a hand-off contract where the GPU
worker plugs in.

---

## What is built (V0)

| Piece | Where |
|---|---|
| Consent gate, recordings, jobs, candidate events, RLS, retention, review RPCs | `supabase/migrations/0013_vision.sql` |
| Consent recorded at league join; gate re-checked at ingest | `supabase/migrations/0014_consent_on_join.sql` |
| **The in-browser scanner** — rim-box motion analysis, no GPU, no deploy | `scan-panel.tsx` + the scan functions in `mobile/core/vision.ts` |
| Review-queue engine — banding, merge, ordering, navigation, calibration maths | `mobile/core/vision.ts` (+ 37 unit tests) |
| Film index: consent roster, pre-flight checklist, resumable upload | `app/(app)/league/[slug]/film/` |
| Review room: player, marker scrubber, keyboard review, roster tagging | `app/(app)/league/[slug]/film/[recordingId]/` |
| Worker contract, runnable today | `scripts/ingest-film-events.mjs` |
| Database proof: gate, RLS, promotion, retention | `scripts/db-test.mjs` (36 assertions) |

The detection itself runs **in the reviewer's browser**: a hidden `<video>`
plays the film muted at 8×, a canvas samples the rim box a few times per
film-second, and frame-differencing finds the moments a ball meets the rim.
Where the motion lived in the box (net-low vs rim-high) leans the call made or
missed. It is the sprint plan's motion-energy heuristic, moved from a Python
CLI into the page that already has the video — so the whole loop works with
zero infrastructure beyond Supabase. A 40-minute game scans in about 5 minutes
in the tab, and the scanner's confidence is deliberately capped below the
bulk-confirm band: a motion heuristic never reaches a box score without a
human looking at each call.

The GPU worker is now an *upgrade*, not a prerequisite — it speaks the same
two RPCs the browser scanner uses, so swapping it in changes nothing above the
contract. Both plans are still right about what makes the upgrade good:
footage, labels, and a ground-truth eval set.

---

## The loop

```
join the league
   └─ consents row recorded automatically (source 'league_join')
upload (browser → Supabase Storage)
   └─ recordings row, status 'uploading'
drag a box around the rim              ← the sprint plan's big shortcut
   └─ rim_roi, stored 0..1 of frame size
Scan for shots (in the review room, right in the browser)
   └─ consent gate fires: one REVOKED player = raise, naming them
   └─ hidden video at 8× → rim-box motion samples → candidates
   └─ set_vision_progress() … ingest_detected_events() … 'review'
review room: J / K / Enter / X, 1–0 to tag a shooter
   └─ confirm_detected_event() → game_events → standings, leaders, box scores
```

A GPU worker slots into the same middle step by calling the same two RPCs.

Nothing downstream of `game_events` changed. Standings, leaderboards, player
pages, and the box score recompute from confirmed film exactly as they do from
a courtside tap.

---

## Decisions worth knowing

**One event vocabulary.** `detected_events.type` is the `game_events`
vocabulary (`fg2_made`, `dreb`, …), not a separate `shot_made`/`shot_attempt`
one. Promotion is then a straight copy with no mapping layer, and the reviewer
never edits across two vocabularies. Without court homography the pipeline
cannot tell a two from a three, so it emits `fg2_*` and the reviewer presses
`T`.

**The candidate's id is the game event's `client_uuid`.** `game_events` already
has `unique (game_id, client_uuid)` for offline sync. Reusing the candidate id
means confirming twice is idempotent, editing after confirming updates in
place, and un-confirming has an exact row to find.

**Promotion must be an RPC.** The `game_events` insert policy requires
`games.status = 'live'`. Film is reviewed after the whistle, so
`confirm_detected_event()` is `security definer`. The RLS policy on
`detected_events` refuses any client write that sets `status <> 'pending'` or a
`promoted_event_id`, so the RPC is the only door.

**Rejecting voids, never deletes.** `game_events` is an append-only ledger
everywhere else in the app and `computeBoxScore()` already skips voided rows.

**Retention is opportunistic.** There is no pg_cron on the free tier, so
`purge_expired_recordings()` is called from the film page, the same pattern
`purge_expired_leagues()` established in 0012. The exact hour does not matter;
that expired film eventually goes away does.

**Guests are never identified.** A pickup player written down by name has no
account, so no consent, so no identity. Their events stay attributable by hand
but never by model.

**Consent is recorded at join, and revocation is the gate.** The league signup
form covers game film, so a trigger on `league_members` writes a consent row
the moment a membership goes active (every path: join code, create, seeds).
`ON CONFLICT DO NOTHING` is what keeps opt-out real — re-joining never
resurrects a revoked consent, and the gate is re-checked inside
`ingest_detected_events` so a revocation that lands mid-scan stops the data
itself, not just the next queue attempt.

---

## The worker contract

The worker needs exactly two RPCs and the `service_role` key. Nothing else —
it never touches a table directly.

```js
// progress, as often as you like
await supabase.rpc("set_vision_progress", {
  p_recording: id, p_stage: "detect",   // decode | detect | classify | emit | done
  p_progress: 0.4, p_status: "running", // queued | running | succeeded | failed
  p_model_version: "yolo11m-rim-v3", p_error: null,
});

// candidates
await supabase.rpc("ingest_detected_events", {
  p_recording: id,
  p_model_version: "yolo11m-rim-v3",
  p_events: [{ type: "fg2_made", ts_ms: 12000, confidence: 0.94,
               frame: 180, period: 1, payload: { rim_crop: "…" } }],
});
```

`stage: 'done'` moves the recording to `review`; `status: 'failed'` moves it to
`failed` and shows your error string to the admin, so make it name the fix
("The camera panned at 14:22 — the rim left its box").

Ingest is idempotent per `(recording, type, ts_ms ± 1.5s)`: a retried job
replaces its own pending output instead of doubling the queue, and never
overwrites a call a human already ruled on.

Run the contract by hand today:

```bash
node scripts/ingest-film-events.mjs <recording-id> events.json v0.1
```

Input it reads (and validates before the round trip):

```json
[{ "type": "fg2_made", "ts_ms": 12000, "confidence": 0.94 }]
```

---

## What the camera cannot see

Say this plainly in product copy, because users will otherwise assume
otherwise. Ranked by what is actually detectable:

- **Solid** — shot attempts, makes and misses, shot timing, rebounds (with
  noise on the offensive/defensive split).
- **Workable with review** — turnovers, steals, assists.
- **Do not attempt from video** — fouls, charges, and-ones, violations. The
  review room has an "add event at the playhead" button and an `A` key for
  exactly these, and says so on screen.

---

## Next, in order

1. **Footage and ground truth.** Record two or three real games and also track
   them on the live console — free ground-truth pairs. They tell you the
   browser scanner's actual recall, which is the number every upgrade is
   measured against.
2. **Tune the scanner** on that footage: `baselineRatio`, the merge gap, and
   the make/miss lean all live in `mobile/core/vision.ts` with tests.
3. **Upgrade the detector** only if the numbers demand it: a real
   ball/rim model (the sprint plan's Roboflow route, or a fine-tuned YOLO11)
   as a Modal T4 worker speaking the same two RPCs — about $0.28 of GPU per
   game. `scripts/ingest-film-events.mjs` is that contract runnable from a
   shell.
4. **Then** the full plan's M2–M4: re-ID and jersey OCR (`tracklets` and
   pgvector, deliberately left out of 0013), derived events, and the eval
   harness that blocks a regressing model version.

The loop works end to end today; everything on this list makes it *better*,
and every step is measured against your own footage.
