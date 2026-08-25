<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Intramural — project guide

School intramural league app. **The spec is `docs/BRIEF.md`** — treat it as
the instruction set. Build order is BRIEF §6; Phase 0 (foundation) is done,
Phase 1 is the draft room. Intramural Vision — game film to a reviewed box
score — is specced in `docs/VISION.md`; its logic lives in `@core/vision`,
its schema in migrations 0018/0019, and its UI under `/league/<slug>/film`.

## Running it

**`docs/OPERATIONS.md` is the setup guide** — Google OAuth, the reminder
cron, provider keys, and the league timezone. Everything external degrades:
no Resend key means email reminders report "not configured" rather than
throwing, no Anthropic key means recaps are assembled from the box score
instead of written. Never make a missing key fatal.

`SUPABASE_SERVICE_ROLE_KEY` is used in exactly one place — `lib/supabase/admin.ts`,
imported only by the cron routes, which have no signed-in user to borrow
permissions from. Every other read goes through `lib/supabase/server.ts` so
RLS stays the one place access is decided.

## Conventions

- Next.js App Router + TypeScript + Tailwind v4. Note Next 16 changes:
  `proxy.ts` (not middleware), `params`/`searchParams` are Promises.
- Supabase for auth/data. Server components use `lib/supabase/server.ts`;
  mutations are server actions colocated in `app/**/actions.ts`. All access
  control lives in RLS/RPCs (`supabase/migrations/`) — never trust the client.
- The app must build and render with NO Supabase env vars: guard with
  `isSupabaseConfigured()`; authed routes redirect to `/setup`.
- Keep stat/scheduling logic in `lib/` as pure, unit-testable functions,
  separate from UI (BRIEF §7). Timing rules, recap facts and award ranking
  live in `@core` for the same reason — they are the parts that go wrong
  silently, so they are the parts that get tests.
- A rule about a *transition* ("only a proposed request may be approved",
  "only the opposing captain may approve it") cannot be a row policy — a
  policy cannot see the previous row, and cannot see a value the caller is
  about to write. Those go in a security-definer RPC. `claim_sub_request`
  and `decide_sub_request` are the worked examples.

## Design

**The brand is `docs/BRANDBOOK.html` (v1.0); `docs/DESIGN.md` maps it onto
the code. Read DESIGN.md before building UI.** Tokens in `app/globals.css`
(`@theme` = the light Sideline preset), palette maths in `@core/theme`,
primitives in `components/ui.tsx`, the shell in `components/shell/shell.tsx`,
the mark in `components/mark.tsx`.

**Every colour is a runtime variable — never write a hex.** Leagues restyle
themselves (Console → Appearance) and people override that for themselves
(Profile → Colours); a literal is a colour they cannot change. Default is
the dark **Court** preset; **Sideline** is the cream-on-Court-Blue original.

In short: cards on the ground, **flat — shadow only on floating overlays**;
Outfit for anything human, JetBrains Mono (`.num`, `.label`) for anything
counted; pill buttons with **one accent button per view**; pair `bg-ink` with
`text-on-ink`, `bg-accent` with `text-on-accent`, and use `text-accent-ink`
when the accent is type; `positive`/`caution` are for the availability scale
only, never chrome; **no emoji ever**; team colours only in `TeamBadge`,
badges and bracket rows, never in chrome; errors name the fix; ≥44px touch
targets. Commissioner surfaces are desktop-dense; player surfaces are
mobile-first.

Navigation and screen copy are data in `lib/nav.ts`, not per-page markup —
add a destination there, not in a layout.
