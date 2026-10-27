import Anthropic from "@anthropic-ai/sdk";

/**
 * The one place the app talks to a model.
 *
 * Two jobs use it — the game recap and the Player of the Week card — and
 * both are the same shape: hand over a block of verified facts, get back a
 * short piece of writing that uses only those facts. Everything numeric has
 * already been computed by `@core/recap-input` and `@core/awards`, so the
 * model is never asked to do arithmetic and can never invent a stat line.
 *
 * With no key configured this reports `configured: false` and the callers
 * fall back to prose assembled from the same facts. A league without an
 * Anthropic account still gets a recap; it just gets a plainer one.
 */

export const RECAP_MODEL = "claude-opus-5-5";

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type WriteResult =
  | { ok: true; headline: string; body: string; model: string }
  /** `reason` is written for the commissioner: it names the fix. */
  | { ok: false; reason: string };

/**
 * Shared voice. Kept identical between the two callers so a recap and an
 * award card read like the same publication, and stated as prohibitions
 * because the failure mode here is invention, not dullness.
 */
const SYSTEM = `You write short recaps for a school intramural league's app. The readers are the players themselves and their friends.

Rules, in order of importance:
1. Use ONLY the facts given. Never invent a statistic, a play, a nickname, a
   crowd, a coach, a quote, or anything a box score cannot show. If you are
   unsure whether something happened, leave it out.
2. Every number you write must appear in the facts, or be a score the
   play-by-play shows. Never add, subtract or average numbers yourself.
3. Use players' and teams' names exactly as given, however unusual — never
   shorten, nickname, re-spell or comment on them. Use full team names, not
   the short names from the play-by-play.
4. Write like a good local sports page: specific, concrete, past tense, in
   the order the game happened. Vary sentence length. Tell the game, don't
   list stats: one player's numbers per sentence at most.
5. No cliché ("came to play", "left it all on the floor", "a game of runs"),
   no hype, no exclamation marks, no emoji, no rhetorical questions, no
   second person.
6. These are students. Be generous about performance and never mocking about
   a bad line — say what happened, not that somebody was bad.

The headline is one line, at most 70 characters, no final period, and says
something more specific than the score alone.
The body is 3 to 5 sentences of flowing prose in one paragraph.`;

/**
 * Ask for a piece of writing. Never throws: when the model is unavailable or
 * answers with something unusable it says why, and callers fall back to
 * prose assembled from the facts — a missing recap must never block a game
 * from being finalized.
 */
export async function write({
  facts,
  task,
  maxTokens = 4000,
}: {
  facts: string;
  task: string;
  maxTokens?: number;
}): Promise<WriteResult> {
  if (!isAiConfigured()) {
    return {
      ok: false,
      reason: "ANTHROPIC_API_KEY isn't set on the server. Add it in Vercel (Production), redeploy, then rewrite the recap.",
    };
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: RECAP_MODEL,
      // A ceiling, not a target: it covers the model's thinking as well as
      // the few sentences it returns, and a cut-off answer is unusable JSON.
      max_tokens: maxTokens,
      system: SYSTEM,
      // Low effort on purpose: this is a short, tightly constrained piece of
      // writing over facts that are already computed, and the latency sits
      // inside finalizing a game.
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              headline: { type: "string" },
              body: { type: "string" },
            },
            required: ["headline", "body"],
            additionalProperties: false,
          },
        },
      },
      messages: [{ role: "user", content: `${task}\n\nFacts:\n${facts}` }],
    });

    if (response.stop_reason === "refusal") {
      return { ok: false, reason: "Claude declined to write this one. Rewrite the recap to try again." };
    }
    if (response.stop_reason === "max_tokens") {
      return { ok: false, reason: "Claude's answer was cut off. Rewrite the recap to try again." };
    }

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");
    const parsed = JSON.parse(text || "{}") as { headline?: unknown; body?: unknown };
    const headline = typeof parsed.headline === "string" ? parsed.headline.trim() : "";
    const body = typeof parsed.body === "string" ? parsed.body.trim() : "";
    if (!body) {
      return { ok: false, reason: "Claude answered with nothing usable. Rewrite the recap to try again." };
    }

    return { ok: true, headline: headline.slice(0, 120), body, model: response.model || RECAP_MODEL };
  } catch (err) {
    // Never fatal. A rate limit, a network blip, or a malformed response all
    // mean the same thing here: write the plain version instead.
    const reason = explain(err);
    console.error(`AI write failed, falling back: ${reason} (${(err as Error).message})`);
    return { ok: false, reason };
  }
}

/** What went wrong, in terms of what to do about it. */
function explain(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return "Anthropic rejected the API key. Replace ANTHROPIC_API_KEY in Vercel with a current key and redeploy.";
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return "This Anthropic key isn't allowed to use the model. Check the key's workspace in the Anthropic console.";
  }
  if (err instanceof Anthropic.NotFoundError) {
    return `This Anthropic key can't reach ${RECAP_MODEL}. Check the key's workspace in the Anthropic console.`;
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "Anthropic is rate-limiting this key. Wait a minute, then rewrite the recap.";
  }
  if (err instanceof Anthropic.BadRequestError) {
    // Most often an empty credit balance; the API's own words say which.
    const detail =
      (err.error as { error?: { message?: string } } | undefined)?.error?.message ?? err.message;
    return `Anthropic refused the request: ${detail} If it mentions credit, add credit in the Anthropic console.`;
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return "Couldn't reach Anthropic. Rewrite the recap to try again.";
  }
  if (err instanceof Anthropic.APIError) {
    return `Anthropic returned an error (${err.status ?? "no status"}). Rewrite the recap to try again.`;
  }
  if (err instanceof SyntaxError) {
    return "Claude's answer couldn't be read. Rewrite the recap to try again.";
  }
  return "Claude couldn't write this one. Rewrite the recap to try again.";
}
