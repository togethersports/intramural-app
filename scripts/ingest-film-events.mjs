/*
  Pushes a list of candidate events into a recording's review queue.

  This is the exact contract the GPU worker uses — the worker is a program
  that produces this JSON and then makes these two calls. Having it as a
  script means the review room is exercisable today, against hand-written or
  locally-produced events, before any of the inference stack exists.

  Run:  node scripts/ingest-film-events.mjs <recording-id> <events.json> [model-version]
  Needs SUPABASE_SERVICE_ROLE_KEY — set_vision_progress() and
  ingest_detected_events() are the only two functions granted to it.

  events.json is an array of:
    { "type": "fg2_made", "ts_ms": 12000, "confidence": 0.94,
      "frame": 180, "period": 1, "payload": { "rim_crop": "..." } }

  `type` must be a game_events type (fg2_made, fg2_miss, fg3_made, fg3_miss,
  ft_made, ft_miss, oreb, dreb, ast, stl, blk, to) — the pipeline speaks the
  app's vocabulary so promotion is a straight copy. Without court homography
  it cannot tell a two from a three, so it emits fg2_* and the reviewer
  upgrades with one key.
*/
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

function loadEnvLocal() {
  try {
    const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m || process.env[m[1]]) continue;
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // no .env.local — the environment must provide everything
  }
}

const VALID_TYPES = new Set([
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
]);

/** Rejects the malformed rows before the round trip, so a typo in one event
    does not fail the whole ingest with a Postgres cast error. */
export function validateEvents(events) {
  if (!Array.isArray(events)) return ["The file must contain a JSON array of events."];
  const problems = [];
  events.forEach((e, i) => {
    if (!VALID_TYPES.has(e?.type)) {
      problems.push(`Event ${i}: "${e?.type}" is not a game event type.`);
    }
    if (!Number.isFinite(e?.ts_ms) || e.ts_ms < 0) {
      problems.push(`Event ${i}: ts_ms must be a non-negative number of milliseconds.`);
    }
    if (!Number.isFinite(e?.confidence) || e.confidence < 0 || e.confidence > 1) {
      problems.push(`Event ${i}: confidence must be between 0 and 1.`);
    }
  });
  return problems;
}

async function main() {
  loadEnvLocal();
  const [recordingId, file, modelVersion = "manual-ingest"] = process.argv.slice(2);
  if (!recordingId || !file) {
    console.error(
      "Usage: node scripts/ingest-film-events.mjs <recording-id> <events.json> [model-version]",
    );
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Set NEXT_PUBLIC_SUPABASE_URL (or .env.local) and SUPABASE_SERVICE_ROLE_KEY.",
    );
    process.exit(1);
  }

  const events = JSON.parse(readFileSync(file, "utf8"));
  const problems = validateEvents(events);
  if (problems.length > 0) {
    console.error(problems.join("\n"));
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Exactly what the worker does: report progress, write candidates, report done.
  const stage = async (name, progress, status = "running", error = null) => {
    const { error: rpcError } = await supabase.rpc("set_vision_progress", {
      p_recording: recordingId,
      p_stage: name,
      p_progress: progress,
      p_status: status,
      p_model_version: modelVersion,
      p_error: error,
    });
    if (rpcError) throw new Error(`set_vision_progress(${name}): ${rpcError.message}`);
  };

  try {
    await stage("emit", 0.9);
    const { data, error } = await supabase.rpc("ingest_detected_events", {
      p_recording: recordingId,
      p_model_version: modelVersion,
      p_events: events,
    });
    if (error) throw new Error(error.message);
    await stage("done", 1, "succeeded");
    console.log(`Ingested ${data} candidate event(s). The recording is ready to review.`);
  } catch (err) {
    await stage("emit", 0, "failed", err.message).catch(() => {});
    console.error(err.message);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  });
}
