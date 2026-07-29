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
(`@theme`), primitives in `components/ui.tsx`, the mark in
`components/mark.tsx`, living reference at `/design`.

In short: cream cards on the Court Blue ground, **flat — shadow only on
floating overlays**; Outfit for anything human, JetBrains Mono (`.num`,
`.label`) for anything counted; pill buttons with **one red button per
view**; no green, no amber, **no emoji ever**; team colours only in
`TeamBadge` and bracket rows, never in chrome; errors name the fix; ≥44px
touch targets. Commissioner surfaces are desktop-dense; player surfaces are
mobile-first.
