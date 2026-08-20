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

export const RECAP_MODEL = "claude-opus-5";

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export interface WriteResult {
  headline: string;
  body: string;
  model: string;
}

/**
 * Shared voice. Kept identical between the two callers so a recap and an
 * award card read like the same publication, and stated as prohibitions
 * because the failure mode here is invention, not dullness.
 */
const SYSTEM = `You write short recaps for a school intramural league's app.

Rules, in order of importance:
1. Use ONLY the facts given. Never invent a statistic, a quarter, a play, a
   nickname, a crowd, a coach, or anything a box score cannot show. If you
   are unsure whether something happened, leave it out.
2. Every number you write must appear verbatim in the facts.
3. Use players' real names as given. Never shorten, nickname, or re-spell.
4. Write plainly and specifically. No cliché ("came to play", "left it all
   on the floor"), no hype, no exclamation marks, no emoji, no rhetorical
   questions, no second person.
5. These are students. Be generous about performance and never mocking about
   a bad line — say what happened, not that somebody was bad.

Return your answer as JSON with exactly two keys: "headline" and "body".
The headline is one line, at most 70 characters, no final period.
The body is 3 to 5 sentences of flowing prose in one paragraph.`;

/**
 * Ask for a piece of writing. Returns null when the model is unavailable or
 * answers with something unusable — callers treat that as "use the fallback"
 * rather than as an error, because a missing recap must never block a game
 * from being finalized.
 */
export async function write({
  facts,
  task,
  maxTokens = 1024,
}: {
  facts: string;
  task: string;
  maxTokens?: number;
}): Promise<WriteResult | null> {
  if (!isAiConfigured()) return null;

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: RECAP_MODEL,
      max_tokens: maxTokens,
      system: SYSTEM,
      // Low effort on purpose: this is a short, tightly constrained piece of
      // writing over facts that are already computed. There is nothing here
      // worth thinking hard about, and the latency sits inside finalizing a
      // game.
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

    if (response.stop_reason === "refusal") return null;

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");
    if (!text.trim()) return null;

    const parsed = JSON.parse(text) as { headline?: unknown; body?: unknown };
    const headline = typeof parsed.headline === "string" ? parsed.headline.trim() : "";
    const body = typeof parsed.body === "string" ? parsed.body.trim() : "";
    if (!body) return null;

    return { headline: headline.slice(0, 120), body, model: RECAP_MODEL };
  } catch (err) {
    // Never fatal. A rate limit, a network blip, or a malformed response all
    // mean the same thing here: write the plain version instead.
    console.error(`AI write failed, falling back: ${(err as Error).message}`);
    return null;
  }
}
