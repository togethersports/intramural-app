# Intramural — Design Language

Derived from the "Tournament Organizer Dashboard" visual inspiration supplied
with the brief. Every new surface should read as part of this system.

## The look in one sentence

Off-white cards with big soft radii floating on a muted steel-blue canvas,
near-black ink, one crimson accent doing all the data work, pill chips, and
airy-but-dense stat layouts with tabular numerals.

## Tokens

Defined in `app/globals.css` under `@theme` (Tailwind v4).

| Token | Value | Use |
|---|---|---|
| `canvas` | `#8399ac` | Page background (gradient `canvas-soft → canvas → canvas-deep`) |
| `canvas-deep` | `#64798c` | Gradient edge, hover states on canvas |
| `canvas-soft` | `#9db0c0` | Gradient top |
| `surface` | `#f4f4f1` | Cards — warm off-white, never pure white |
| `surface-dim` | `#e9eae4` | Nested panels, table stripes, meter tracks |
| `surface-bright` | `#fbfbf9` | Inputs, hover on surface |
| `ink` | `#191c1f` | Primary text, dark buttons |
| `ink-soft` | `#4e5860` | Secondary text |
| `ink-faint` | `#8b959d` | Tertiary text, placeholders |
| `accent` | `#c8232c` | Crimson — charts, meters, live indicators, primary emphasis |
| `accent-wash` | `#f3e0de` | Track behind crimson bars/meters |
| `court` | `#54749b` | Schematic panels (court diagrams, dark stat panels) |
| `sage` / `amber` | `#8fae7f` / `#dfa04f` | Positive / caution states only |

## Rules

- **Radii:** outer cards `rounded-card` (28px), nested panels `rounded-panel`
  (20px), controls `rounded-control` (14px), chips and avatars full pill.
- **Color discipline:** crimson is the only saturated color in a view by
  default. Sage/amber appear only as semantic states. League/team custom
  colors are the sanctioned exception.
- **Type:** Instrument Sans everywhere. Headings `tracking-tight`,
  `font-semibold`. Stats use `.stat-num` (tabular, -3% tracking). Labels are
  small, `text-ink-faint`, medium weight — never all-caps walls.
- **On canvas:** text is white; secondary text `white/70`; chips are the
  translucent `.chip` style.
- **Depth:** cards get `shadow-card`; interactive floating elements
  `shadow-float`. No borders on cards — separation comes from shadow and the
  canvas showing through the gutters.
- **Data viz:** crimson marks on `accent-wash` or `surface-dim` tracks. Court
  schematics draw white 1.5px lines on `court` blue.
- **Touch:** every target ≥ 44px (`min-h-11`), contrast ≥ 4.5:1.
- **Density:** commissioner/desktop views can be dense; player/mobile views
  get one clear action per screen and big tap targets.

## Motifs from the inspo we reuse

- Hero panel bleeding into the canvas with pill chips under the headline
- Stat tiles: label top-left, icon top-right, huge numeral, small viz below
- Horizontal crimson meter bars on pale tracks for "most active" lists
- Court diagram drawn in white line-art on court-blue, with dimension ticks
- Search as a pill in the top bar; avatar chip with name + role on the right
