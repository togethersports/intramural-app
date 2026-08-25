# Intramural — brand in code

Implementation of **Brandbook v1.0 (July 2026)**. The brandbook is the
authority; this file maps it onto the codebase.

There used to be a set of `/design` reference routes rendering the real
components against fixture data. They were public pages on a product site,
which is the wrong place for a brand reference, so they were removed — read
the components themselves, or `git show 5982038:app/design/page.tsx` for
what they held.

## Two presets, one token set

Every colour in the signed-in app is a **runtime CSS variable**, not a
literal. A league picks its palette in Console → Appearance; a person can
override it for themselves in Profile → Colours. That is only possible
because nothing downstream writes a hex code: **a colour written as a
literal is a colour a league cannot restyle.**

- **Court** — the shipped default. A near-black ground (`#101218`) carrying
  two soft radial washes, cards that are white at 6% with a hairline and an
  18px backdrop blur, coral accent. Dark, quiet, and the accent is the only
  saturated thing on screen.
- **Sideline** — the original brand: Sideline Cream cards on Court Blue,
  Whistle Red accent, flat with no borders. Still what the marketing site,
  the docs and the auth screens are drawn in.

`@core/theme` owns both. `buildPalette(appearance)` derives every token from
the preset plus one accent hex; `paletteCss()` serialises it; the
`<ThemeStyle>` component re-declares the whole set on `:root` from inside
the body, which beats Tailwind's `@theme` block by document order. The
accent is hex-validated before it ever reaches CSS, and the derived text
colours are **contrast-computed, not chosen** — `readableOn()` picks the
text on a fill and `accentOn()` lifts or darkens the accent until it clears
4.5:1 on the ground it lands on. A league that picks navy still gets a
readable link colour. `mobile/core/theme.test.ts` pins that.

## Token map

Tokens are semantic in code, branded in the book. The `@theme` block in
`app/globals.css` holds the **Sideline** values; the runtime block replaces
them.

| Token | Sideline | Court | Use |
|---|---|---|---|
| `ink` | `#17171A` | `#F4F5F7` | Primary text **and** the contrast fill |
| `on-ink` | `#FFFFFF` | `#16181F` | Text printed on an `ink` fill |
| `accent` | `#C9242C` | `#FF5C48` | The one action, the decision, live |
| `on-accent` | computed | computed | Text printed on the accent |
| `accent-ink` | computed | computed | The accent used **as text** |
| `canvas` | `#8FA6BF` | `#101218` | The ground the app sits on |
| `on-canvas` | `#FFFFFF` | `#F4F5F7` | Text printed on the bare ground |
| `surface` | `#F1EFE8` | `rgb(255 255 255 / 6%)` | Cards |
| `paper` | `#FFFFFF` | `rgb(0 0 0 / 22%)` | Nested rows inside cards |
| `bench` | `#4E7CA8` | `#5865C9` | Slot chips, tags |
| `tint` | accent @14% | accent @16% | Active rows, meter tracks, errors |
| `ink-body` / `-muted` / `-faint` | `#3A3C41` / `#5A5C61` / `#8A8C91` | `#B8BCC7` / `#A4A9B6` / `#7D8290` | Body, secondary, mono labels |
| `rule` / `rule-soft` | `#E7E5DD` / `#E2E0D8` | white @11% / @7% | Hairlines |
| `positive` / `caution` | `#2F7D5B` / `#9A7220` | `#8FE0B4` / `#E8C887` | Availability scale only |

**The `ink` pair is the rule that matters.** `ink` is simultaneously the
primary text colour and the solid fill behind `on-ink` text — which is why
`bg-ink text-white` is wrong: on a dark preset `ink` *is* near-white. Always
pair `bg-ink` with `text-on-ink`, `bg-accent` with `text-on-accent`, and use
`text-accent-ink` (never `text-accent`) when the accent is type.

`positive` and `caution` exist **only** for the availability grid and
win/loss pips, where the reading is a scale rather than a decision. They are
never chrome and never a button. Everything else that used to want "success"
is `ink`; warnings are the accent with a sentence that names the fix.

**Ratio:** 60% ground · 30% cards and rows · 8% contrast fill · 2% accent.
Two background colours per surface, maximum.

**School colours:** a team's colour appears only in `TeamBadge`, the team
badge/photo, and bracket/standings rows. Never on chrome, headers, or
buttons.

## Type

- **Outfit** for anything human, **JetBrains Mono** for anything counted.
- Weights 400 / 500 / 600 only. No 700, no italics (enforced in base CSS).
- Display 72/0.94/600 · Heading 36/1.05/600 · Body 17/1.55/400, max 62ch.
- Sentence case everywhere except mono labels. Headlines take a period when
  they state something.
- Use `.num` for any number a student would argue about — scores, picks,
  clock, seeds, plus/minus. Use `.label` for the 13px/0.16em uppercase mono
  eyebrow. Never mix the two typefaces inside one word.

## Structure

Signed-in surfaces are one shape: a **sticky rail** on the left (league
identity, a Player/Commish toggle for admins, destinations grouped under
mono section labels with a two-digit tick, then the global links and the
user card), and a **screen header** carrying crumb → title → subtitle with
at most one action on the right. The rail becomes a drawer under `lg`.

Both are data-driven, not per-page markup: `lib/nav.ts` holds the groups and
the screen copy, `components/shell/shell.tsx` draws them. The two modes
contain **the same destinations in a different order** — switching modes can
never lose you a page. Detail routes (team, player, game) return an empty
title so their own hero names the thing.

## Components

- `.card` — the primary surface, 20px radius, **flat**. On Court it is glass:
  the fill is white at low alpha, `--card-border` gives it an edge and
  `--card-blur` the depth. Shadow only on floating overlays, via
  `.card-float`; `.card-solid` composites the surface over the ground for
  anything that must be opaque (the drawer).
- `.sticky-cell` — a frozen first column in a scrolling table. Composites
  surface over ground, because a translucent fill lets the columns slide
  visibly underneath.
- `.avatar` — identity disc, photo or initials. Deliberately *not* the
  contrast fill: a grid of solid white discs reads as UI, not as faces.
- `.row` — Paper White nested row, 12px radius, mono index on the left.
- Buttons — 999px pill, 14/24 padding. **One red button per view**:
  `variant="accent"` is the single defining action on a screen. On Court
  Blue, secondary buttons are `variant="canvas"` (22% white fill).
- `.chip` — Bench Blue slot/tag pill. `.chip-stat` — Night Court mono pill
  for stat actions. `.chip-canvas` — the 22%-white pill used on canvas.
- Radii: cards 18–24px, rows 12–14px, pills 999px. Grid 8px, card pad 24px.

## The mark

`components/mark.tsx` draws The Bracket from the construction spec: 64 × 64
grid, seeds in at y18 / y46, connector, output at y32 in Whistle Red, stroke
6, round caps. `<Mark>` drops the red line below 20px automatically.
`<Lockup>` sets the wordmark at 0.53× mark width with a 0.28× gap. Never
re-weight, mirror, rotate, or recolour the input lines.

## Identity

People, leagues and teams all carry a picture. Photos live in two public
Supabase buckets — `avatars/<user_id>/` and `badges/<league_id>/` — behind
`lib/uploads.ts`, which validates type and size and derives the stored name
rather than trusting the upload's. Public because these images appear on
rosters and box scores every member can already see, and signing sixty
avatars on one page would be sixty round trips.

Who may edit what: a **player** owns their own photo, name, grade, height,
jersey preference and positions; a **captain** owns their team's name,
abbreviation, colour, badge, and their roster's positions, jerseys and
starting lineup; a **commissioner** owns the league's name, logo and
palette, and keeps every power a captain has. All of it is enforced in RLS
(`supabase/migrations/0014_*`), never in the action.

## Voice

Verbs first. Real nouns (gyms, periods, seeds, picks). **No emoji, ever** —
mono category labels and stat chips carry the energy. Errors name the fix:
"Gym 1 is taken at Lunch A. Pick another slot."

## Known deviation

The brandbook sanctions white text at 500+ on Court Blue; measured, that is
about 2.5:1, below the 4.5:1 in BRIEF §9. The app keeps body copy on cream
or Paper White surfaces so this only affects page titles and hero display
type. If strict WCAG AA is required, darken Court Blue for text-bearing
chrome (≈ `#5F7A99` clears 4.5:1 with white) — a brand decision, not a code
one.
