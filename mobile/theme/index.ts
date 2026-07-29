/**
 * Brandbook v1.0 in React Native.
 *
 * These are the same literal values as the web app's `@theme` block in
 * app/globals.css — if one changes, change both. See docs/DESIGN.md.
 */

export const color = {
  /* Core four */
  ink: "#17171A", // Night Court    — text, dark panels
  accent: "#C9242C", // Whistle Red  — the one action / the decision
  canvas: "#8FA6BF", // Court Blue   — the ground
  surface: "#F1EFE8", // Sideline Cream — cards

  /* Support */
  bench: "#4E7CA8", // Bench Blue    — slot chips, tags
  tint: "#F7DCDC", // Red Tint       — active rows, meter tracks
  paper: "#FFFFFF", // Paper White   — nested rows

  /* Ink scale */
  inkBody: "#3A3C41",
  inkMuted: "#5A5C61",
  inkFaint: "#8A8C91",
  rule: "#E7E5DD",
  ruleSoft: "#E2E0D8",
  blush: "#F1A0A4", // light red — labels on Night Court only

  white: "#FFFFFF",
} as const;

/** Cards 18–24, rows 12–14, pills 999 (brandbook 06). */
export const radius = {
  card: 20,
  panel: 18,
  row: 12,
  control: 14,
  pill: 999,
} as const;

/** 8px grid. */
export const space = (n: number) => n * 8;

export const font = {
  /* Outfit for anything human. Weights 400/500/600 only — no 700, no italics. */
  regular: "Outfit_400Regular",
  medium: "Outfit_500Medium",
  semibold: "Outfit_600SemiBold",
  /* JetBrains Mono for anything counted. */
  mono: "JetBrainsMono_400Regular",
  monoMedium: "JetBrainsMono_500Medium",
} as const;

/**
 * Type scale. Display 72/0.94/600 · Heading 36/1.05/600 · Body 17/1.55/400.
 * Tracking tightens as size grows; never track out a headline.
 */
export const type = {
  display: {
    fontFamily: font.semibold,
    fontSize: 44,
    lineHeight: 44 * 0.98,
    letterSpacing: -1.4,
  },
  h1: {
    fontFamily: font.semibold,
    fontSize: 32,
    lineHeight: 32 * 1.05,
    letterSpacing: -0.8,
  },
  h2: {
    fontFamily: font.semibold,
    fontSize: 22,
    lineHeight: 22 * 1.15,
    letterSpacing: -0.4,
  },
  body: { fontFamily: font.regular, fontSize: 17, lineHeight: 17 * 1.55 },
  bodyMedium: { fontFamily: font.medium, fontSize: 17, lineHeight: 17 * 1.4 },
  small: { fontFamily: font.regular, fontSize: 15, lineHeight: 15 * 1.45 },
  /* The brand's signature mono eyebrow: 13/0.16em/uppercase/500. */
  label: {
    fontFamily: font.monoMedium,
    fontSize: 13,
    letterSpacing: 13 * 0.16,
    textTransform: "uppercase" as const,
    color: color.inkFaint,
  },
  /* Anything a student would argue about — scores, picks, clock, seeds. */
  num: { fontFamily: font.monoMedium, fontVariant: ["tabular-nums" as const] },
} as const;

/** Shadow lives on floating overlays only — never on a resting card. */
export const shadowFloat = {
  shadowColor: color.ink,
  shadowOpacity: 0.18,
  shadowRadius: 40,
  shadowOffset: { width: 0, height: 15 },
  elevation: 12,
};

/** Every tappable thing clears 44px (BRIEF §9). */
export const HIT = 44;
