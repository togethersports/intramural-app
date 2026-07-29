# packages/core

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

## How each side imports it

There is deliberately no npm package name and no workspace — the web app
pins React 19.2.4 and the mobile app 19.2.8, and a hoisted root
`node_modules` would force one of them onto the other's copy.

- **Web** — `@/packages/core/stats`, riding the existing `@/* -> ./*` alias.
- **Mobile** — `@core/stats`, via `mobile/tsconfig.json` paths plus Metro
  `watchFolders`.

The cost of that is real: the same file has two specifiers, so a rename has
to update both. It buys complete independence of the two dependency trees.

Tests run under vitest from the repo root (`npm test`), and
`npm run typecheck:core` enforces the no-DOM rule (the root tsconfig
includes `dom`, so the guard only fires when the package is checked
directly).
