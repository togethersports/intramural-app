import type { Metadata } from "next";
import { LandingPage } from "@/components/landing-page";
import { getUser } from "@/lib/auth";

/**
 * The landing page, in the Whistle Red preset — the same page as `/`, with
 * Court Blue retired.
 *
 * It is the real page, not a mock-up: it renders `<LandingPage />`, the same
 * component `/` renders, under a different set of colour tokens. Nothing is
 * duplicated, so the preview cannot drift away from the thing it previews,
 * and anything that looks wrong here is a real result rather than an
 * artefact of a copy.
 *
 * How it works is the mechanism a league already uses to restyle itself:
 * Tailwind's `@theme` writes the Sideline brand onto `:root` from the
 * stylesheet in <head>, and the block below writes over it from inside the
 * body — same specificity, later in document order, so it wins, `body`
 * included. See components/theme-style.tsx, which does this per league.
 *
 * Not linked from anywhere and not indexed. It is a decision aid: look at
 * it, then either bring the palette into globals.css or delete this route.
 */
export const metadata: Metadata = {
  title: "Whistle Red preview",
  robots: { index: false, follow: false },
};

/*
  The preset. Four of the brandbook's colours do all the work and the fifth,
  Court Blue, is gone:

    ground     Paper White      the page, where Court Blue used to be
    band       Night Court      the ticker and the draft board, unchanged
    accent     Whistle Red      the one decision, unchanged
    cards      Bone             a warm off-white, biased toward the red —
                                Sideline Cream is yellow-leaning and fights it

  Ink stays Night Court, which is what lets the giant hero marquee read as
  black-on-white rather than needing its own rule.
*/
const WHISTLE_RED = `
  --color-canvas: #ffffff;
  --canvas-image: none;
  --color-on-canvas: #17171a;
  --color-surface: #f4f1ef;
  --color-paper: #ffffff;
  --color-ink: #17171a;
  --color-on-ink: #ffffff;
  --color-ink-body: #3a3c41;
  --color-ink-muted: #5a5c61;
  --color-ink-faint: #8a8c91;
  --color-rule: #e6e1de;
  --color-rule-soft: #ded9d6;
  --color-accent: #c9242c;
  --color-accent-strong: #ac1f26;
  --color-on-accent: #ffffff;
  --color-accent-ink: #c9242c;
  --color-tint: #f7dcdc;
  --color-bench: #17171a;
  --color-blush: #f1a0a4;
`;

export default async function WhistleRedPreview() {
  const user = await getUser();
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `:root{${WHISTLE_RED}}` }} />
      <LandingPage
        signedIn={Boolean(user)}
        startHref={user ? "/leagues/new" : "/signup"}
        joinHref={user ? "/join" : "/login"}
      />
    </>
  );
}
