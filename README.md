# Intramural

A web app for running school intramural sports leagues: captains draft teams,
games are scheduled into lunch and free periods, stats are tracked live from
the sideline, and playoffs settle it. Basketball first; the data model
supports other sports.

The full product brief lives in [`docs/BRIEF.md`](docs/BRIEF.md); the design
language in [`docs/DESIGN.md`](docs/DESIGN.md) (living reference at `/design`).

## Status

**Phase 0 — Foundation** (this repo so far):

- Marketing landing page
- Auth (email + password via Supabase), minimal data collection: name, email, grade
- Create a league (become commissioner) / join by 6-character code
- League home, member roster, role management (commissioner/admin/captain/player/spectator)
- Responsive shell: desktop icon-rail console, mobile bottom tabs; installable PWA manifest
- Postgres migrations with RLS for `profiles`, `organizations`, `leagues`, `league_members`

Next: Phase 1 — the draft room (see `docs/BRIEF.md` §6 for the build order).

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
  (app)/             authenticated shell: dashboard, join, leagues/new, league/[slug]
  design/            living styleguide
components/          ui primitives, icons, shell
lib/                 supabase clients, auth + league data helpers
supabase/migrations/ SQL, RLS policies, RPCs
docs/                BRIEF.md (product spec), DESIGN.md (design language)
proxy.ts             Supabase session refresh (Next 16 proxy convention)
```
