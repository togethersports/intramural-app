/**
 * The Court preset in React Native — the same night-glass palette the web
 * app defaults to (`@core/theme`, preset "court") and the watch ships with.
 * If a value changes there, change it here: canvas #101218, glass cards at
 * 6% white with an 11% border, ink #F4F5F7, coral #FF5C48.
 *
 * Same token *names* as before the retheme so every screen keeps compiling —
 * but the polarity flipped: `ink` is now light, and anything that puts ink
 * on a white or coral fill must use `onLight` instead.
 */

export const color = {
  /* Core four */
  ink: "#F4F5F7", // text — light on the night ground
  accent: "#FF5C48", // Coral — the one action / the decision
  canvas: "#101218", // the night ground everything sits on
  surface: "rgba(255,255,255,0.06)", // glass card

  /* Support */
  bench: "rgba(255,255,255,0.09)", // slot chips, tags
  tint: "rgba(255,92,72,0.13)", // active rows, meter tracks
  paper: "rgba(255,255,255,0.09)", // nested rows, inputs

  /* Ink scale */
  inkBody: "#DFE2E8",
  inkMuted: "#8A8F9C",
  inkFaint: "#7D8290",
  rule: "rgba(255,255,255,0.10)",
  ruleSoft: "rgba(255,255,255,0.07)",
  blush: "#FFB0A2", // coral-tinted labels on the night ground

  white: "#FFFFFF",

  /* A team with no colour still needs a solid one — chips went glass, and a
     translucent badge disappears into the card behind it. */
  teamFallback: "#54749B",

  /* Dark type for light fills — white pills, the coral button. `ink` used to
     play this role; now that ink is light it would vanish on white. */
  onLight: "#16181F",
  /* The 1px edge that makes a glass card read as a card. */
  glassBorder: "rgba(255,255,255,0.11)",

  /* Availability scale only — never chrome. */
  positive: "#8FE0B4",
  positiveBg: "rgba(96,196,140,0.16)",
  caution: "#E8C887",
  cautionBg: "rgba(226,178,84,0.15)",
  danger: "#FF9C8B",
  dangerBg: "rgba(255,92,72,0.14)",
} as const;

/** Cards 20–26, rows 12–14, pills 999 — a touch rounder than the web, per
    the Midnight Glass reference. */
export const radius = {
  card: 24,
  panel: 20,
  row: 14,
  control: 15,
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
 * Type scale. Tracking tightens as size grows; never track out a headline.
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
    fontSize: 30,
    lineHeight: 30 * 1.08,
    letterSpacing: -0.8,
  },
  h2: {
    fontFamily: font.semibold,
    fontSize: 21,
    lineHeight: 21 * 1.18,
    letterSpacing: -0.4,
  },
  body: { fontFamily: font.regular, fontSize: 16.5, lineHeight: 16.5 * 1.5 },
  bodyMedium: { fontFamily: font.medium, fontSize: 16.5, lineHeight: 16.5 * 1.4 },
  small: { fontFamily: font.regular, fontSize: 14.5, lineHeight: 14.5 * 1.45 },
  /* The signature mono eyebrow: small caps, wide tracking. */
  label: {
    fontFamily: font.monoMedium,
    fontSize: 11,
    letterSpacing: 11 * 0.18,
    textTransform: "uppercase" as const,
    color: color.inkFaint,
  },
  /* Anything a student would argue about — scores, picks, clock, seeds. */
  num: { fontFamily: font.monoMedium, fontVariant: ["tabular-nums" as const] },
} as const;

/** Shadow lives on floating overlays only — never on a resting card. */
export const shadowFloat = {
  shadowColor: "#000000",
  shadowOpacity: 0.5,
  shadowRadius: 30,
  shadowOffset: { width: 0, height: 12 },
  elevation: 14,
};

/** Every tappable thing clears 44px (BRIEF §9). */
export const HIT = 44;
