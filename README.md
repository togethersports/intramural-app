# Intramural

A web app for running school intramural sports leagues: captains draft teams,
games are scheduled into lunch and free periods, stats are tracked live from
the sideline, and playoffs settle it. Basketball first; the data model
supports other sports.

The full product brief lives in [`docs/BRIEF.md`](docs/BRIEF.md); the design
language in [`docs/DESIGN.md`](docs/DESIGN.md) (living reference at `/design`).

## Status

The full league loop works end to end:

- **Foundation** — auth (name/email/grade only), league create/join by code,
  members + roles, responsive shell, PWA manifest
- **Console** — seasons with rules (roster sizes, availability threshold),
  named time slots (Lunch A, Free 6…), venues with splittable capacity
- **Teams & draft** — teams with captains, live draft room (snake/linear,
  pick clock with countdown ring, captain queues, auto-pick, undo, pause,
  realtime pick ticker)
- **Availability & scheduling** — tap-fast weekly grid, per-team heatmap,
  nudge notifications, auto-scheduler (greedy + backtracking over scored
  slot/venue cells with a conflict report), manual game management,
  reschedule-with-notify, scorekeeper assignment
- **Live tracking & stats** — two-tap courtside tracker (player → event),
  assist prompt, substitutions, undo, offline event queue with idempotent
  sync (`client_uuid`), automatic plus/minus from lineups, box scores,
  play-by-play, leaderboards, player/team pages
- **Standings & playoffs** — explainable tiebreakers (H2H → diff → PF),
  seeded single-elimination bracket with byes and auto-advance, champion
  crowning
- **Trades & social** — captain proposals, accept/decline, commissioner
  approve/veto (or league auto-approve), roster-size validation, audit log,
  auto feed posts (finals, trades), announcements, in-app notification inbox

Deferred (schema often already in place): auction drafts, availability
date-overrides UI, web-push delivery (subscriptions table exists; in-app
inbox works), reactions UI, weekly awards UI, multi-team trades,
game-reminder cron, public no-login league pages.

## Tests

- `npm test` — unit tests for the pure logic: stats/plus-minus engine,
  scheduler, standings tiebreakers, brackets
- `npm run test:db` — applies every migration to an in-memory Postgres
  (PGlite) and replays a full season scenario: signup → league → draft
  (queues, auto-pick, undo) → availability → live game events (idempotency)
  → finalize → trade flow

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS v4
- Supabase: auth, Postgres with RLS, realtime (used from Phase 1 on)

## Getting started

1. `npm install`
2. Create a [Supabase](https://supabase.com) project.
3. Run the SQL in `supabase/migrations/` against it (SQL editor or
   `supabase db push` with the CLI).
4. `cp .env.example .env.local` and fill in the URL and anon key.
5. `npm run dev`

Without env vars the app still runs: public pages render and authenticated
routes redirect to `/setup`, which explains what to configure.

## Structure

```
app/                 routes (App Router)
  (auth)/            login, signup + server actions
  (app)/             authenticated shell: dashboard, inbox, join, leagues/new
    league/[slug]/   overview, schedule, standings, stats, teams, availability,
                     draft (live room), trades, playoffs, members, console,
                     game/[id] (+ /track), player/[id], team/[id], actions.ts
  design/            living styleguide
components/          ui primitives, icons, shell, game card, standings table
lib/                 supabase clients, data layer, and PURE tested logic:
                     stats.ts, scheduler.ts, standings.ts, bracket.ts
supabase/migrations/ SQL: full data model, RLS on every table, RPCs
scripts/db-test.mjs  PGlite end-to-end migration + scenario test
docs/                BRIEF.md (product spec), DESIGN.md (design language)
proxy.ts             Supabase session refresh (Next 16 proxy convention)
```
