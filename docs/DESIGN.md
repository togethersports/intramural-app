# Intramural — brand in code

Implementation of **Brandbook v1.0 (July 2026)**. The brandbook is the
authority; this file maps it onto the codebase. Living reference: **`/design`**.

## Token map

Tokens are semantic in code, branded in the book. Defined in
`app/globals.css` under `@theme`.

| Brand name | Token | Hex | Use |
|---|---|---|---|
| Night Court | `ink` | `#17171A` | Text, dark panels, primary buttons |
| Whistle Red | `accent` | `#C9242C` | The one action, the decision, live |
| Court Blue | `canvas` | `#8FA6BF` | The ground the app sits on |
| Sideline Cream | `surface` | `#F1EFE8` | Cards |
| Bench Blue | `bench` | `#4E7CA8` | Slot chips, tags |
| Red Tint | `tint` | `#F7DCDC` | Active rows, meter tracks |
| Paper White | `paper` | `#FFFFFF` | Nested rows inside cards |
| — | `ink-body` | `#3A3C41` | Body copy on cream |
| — | `ink-muted` | `#5A5C61` | Secondary, captions |
| — | `ink-faint` | `#8A8C91` | Mono labels, disabled |
| — | `rule` / `rule-soft` | `#E7E5DD` / `#E2E0D8` | Hairlines |

There is deliberately **no green and no amber**. States that used to be
"success" are Night Court; warnings are Whistle Red with a sentence that
names the fix.

**Ratio:** 60% Court Blue · 30% cream and white · 8% Night Court · 2%
Whistle Red. Two background colours per surface, maximum.

**School colours:** a team's colour appears only in `TeamBadge` and in
bracket/standings rows. Never on chrome, headers, or buttons.

## Type

- **Outfit** for anything human, **JetBrains Mono** for anything counted.
- Weights 400 / 500 / 600 only. No 700, no italics (enforced in base CSS).
- Display 72/0.94/600 · Heading 36/1.05/600 · Body 17/1.55/400, max 62ch.
- Sentence case everywhere except mono labels. Headlines take a period when
  they state something.
- Use `.num` for any number a student would argue about — scores, picks,
  clock, seeds, plus/minus. Use `.label` for the 13px/0.16em uppercase mono
  eyebrow. Never mix the two typefaces inside one word.

## Components

- `.card` — cream, 20px radius, **flat**. Shadow only on floating overlays,
  via `.card-float` (`0 30px 80px / 18%`).
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
