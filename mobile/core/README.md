# mobile/core

Pure domain logic, shared by the Next.js web app and the Expo iOS app.

**The rule: nothing in here may import Node, Next, React, or a browser
global.** `tsconfig.json` sets `lib: ["ES2020"]` with no `"dom"`, so a stray
`window`/`localStorage` reference fails to compile rather than shipping and
crashing on a phone. Data access (Supabase), auth, and UI stay out — this
package computes, it does not fetch.

- `stats.ts` — box scores and plus/minus, derived from the event stream
- `scheduler.ts` — schedule generation with conflict reporting
- `standings.ts` — records and explainable tiebreakers
- `bracket.ts` — single-elimination seeding and advancement
- `game-constants.ts`, `league-constants.ts`, `types.ts`

## Why it lives inside `mobile/`

This is shared code, so `packages/core/` would be the natural home. It sits
here for one hard constraint: **EAS Build uploads only the Expo project
directory.** A sibling `packages/` is simply not present on the build
machine, and the JS bundle fails with `Unable to resolve module @core/...`
after a ten-minute cloud build. Metro's `watchFolders` makes that work
locally, which is exactly what makes the failure a surprise.

The alternative is declaring npm workspaces so EAS uploads the repo root,
but that puts React Native into the web app's install graph — every Vercel
deploy would fetch the whole native toolchain to build a Next.js site.

So the Expo project is self-contained, and the web app reaches in. Nothing
here is mobile-specific; the web commissioner console is the heaviest
consumer of `scheduler.ts`.

## How each side imports it

Both use the same specifier, `@core/*`:

- **Web** — `tsconfig.json` maps `@core/* -> ./mobile/core/*`
- **Mobile** — `mobile/tsconfig.json` maps `@core/* -> ./core/*`

There is deliberately no npm package name and no workspace — the web app
pins React 19.2.4 and the mobile app 19.2.8, and a hoisted root
`node_modules` would force one of them onto the other's copy.

Tests run under vitest from the repo root (`npm test`), and
`npm run typecheck:core` enforces the no-DOM rule (the root tsconfig
includes `dom`, so the guard only fires when the package is checked
directly).
