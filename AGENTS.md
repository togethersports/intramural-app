<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Intramural — project guide

School intramural league app. **The spec is `docs/BRIEF.md`** — treat it as
the instruction set. Build order is BRIEF §6; Phase 0 (foundation) is done,
Phase 1 is the draft room.

## Conventions

- Next.js App Router + TypeScript + Tailwind v4. Note Next 16 changes:
  `proxy.ts` (not middleware), `params`/`searchParams` are Promises.
- Supabase for auth/data. Server components use `lib/supabase/server.ts`;
  mutations are server actions colocated in `app/**/actions.ts`. All access
  control lives in RLS/RPCs (`supabase/migrations/`) — never trust the client.
- The app must build and render with NO Supabase env vars: guard with
  `isSupabaseConfigured()`; authed routes redirect to `/setup`.
- Keep stat/scheduling logic in `lib/` as pure, unit-testable functions,
  separate from UI (BRIEF §7).

## Design

**The brand is `docs/BRANDBOOK.html` (v1.0); `docs/DESIGN.md` maps it onto
the code. Read DESIGN.md before building UI.** Tokens in `app/globals.css`
(`@theme` = the light Sideline preset), palette maths in `@core/theme`,
primitives in `components/ui.tsx`, the shell in `components/shell/shell.tsx`,
the mark in `components/mark.tsx`, living references at `/design`,
`/design/league`, `/design/identity`, `/design/dashboard`, `/design/live`.

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
