// Appearance: the palette a league (or a person) chooses to see the app in.
//
// Two things are adjustable — the preset, which decides whether the app sits
// on a dark ground or a paper one, and the accent, which is the single colour
// that marks the decision on a screen. Everything else is derived, so a
// league picking a new accent can never produce unreadable text: contrast is
// computed, not guessed.
//
// Pure functions with no DOM and no React, so the web app, the CSS emitter
// and (later) the native app all read the same palette from one source.

export type ThemePreset = "court" | "sideline";

export interface Appearance {
  /** "court" is the dark ground; "sideline" is the cream paper original. */
  preset: ThemePreset;
  /** Hex, `#rrggbb`. The one action colour. */
  accent: string;
}

export const DEFAULT_APPEARANCE: Appearance = {
  preset: "court",
  accent: "#FF5C48",
};

/** Named accents offered in the picker. Any hex is allowed as well. */
export const ACCENT_CHOICES: { name: string; hex: string }[] = [
  { name: "Coral", hex: "#FF5C48" },
  { name: "Whistle", hex: "#C9242C" },
  { name: "Ember", hex: "#F0803C" },
  { name: "Gold", hex: "#E0A33E" },
  { name: "Court", hex: "#3FA88A" },
  { name: "Sky", hex: "#4E9BD8" },
  { name: "Indigo", hex: "#5865C9" },
  { name: "Violet", hex: "#8B5CC7" },
  { name: "Magenta", hex: "#C9468C" },
];

export const THEME_PRESETS: { id: ThemePreset; name: string; note: string }[] = [
  { id: "court", name: "Court", note: "Dark glass on a night ground" },
  { id: "sideline", name: "Sideline", note: "Cream paper on court blue" },
];

/* ------------------------------- colour math ------------------------------ */

/** Parse `#rgb` / `#rrggbb` into 0–255 channels. Returns null when invalid. */
export function parseHex(hex: string): [number, number, number] | null {
  const s = hex.trim().replace(/^#/, "");
  const full =
    s.length === 3
      ? s
          .split("")
          .map((c) => c + c)
          .join("")
      : s;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Normalise any accepted input to `#RRGGBB`, or null when it isn't a colour. */
export function normalizeHex(hex: string): string | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  return (
    "#" +
    rgb
      .map((c) => c.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

function clamp(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function toHex(rgb: [number, number, number]) {
  return "#" + rgb.map((c) => clamp(c).toString(16).padStart(2, "0")).join("");
}

/** Blend `hex` toward white (`amount` > 0) or black (`amount` < 0), 0–1. */
export function shade(hex: string, amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const target = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  return toHex(rgb.map((c) => c + (target - c) * t) as [number, number, number]);
}

/** `rgba()` string for a hex at the given alpha — used for tints and glass. */
export function alpha(hex: string, a: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
}

/** WCAG relative luminance, 0 (black) – 1 (white). */
export function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours, 1–21. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The text colour to print on top of a fill. Picks whichever of near-white
 * and near-black reads better, so an accent of any lightness stays legible.
 */
export function readableOn(fill: string): string {
  return contrast(fill, "#FFFFFF") >= contrast(fill, "#16181F")
    ? "#FFFFFF"
    : "#16181F";
}

/**
 * The accent as *text*, lightened or darkened until it clears 4.5:1 against
 * the surface it will be printed on. A league that picks navy on the dark
 * preset still gets a readable link colour instead of an invisible one.
 */
export function accentOn(accent: string, background: string): string {
  const towardLight = luminance(background) < 0.4;
  let out = accent;
  for (let i = 0; i < 12; i++) {
    if (contrast(out, background) >= 4.5) return out;
    out = shade(out, towardLight ? 0.08 : -0.08);
  }
  return out;
}

/* --------------------------------- presets -------------------------------- */

/** Every semantic colour the app draws with, resolved to concrete values. */
export interface Palette {
  /** Page ground. */
  canvas: string;
  /** Optional gradient painted over the ground; "none" when flat. */
  canvasImage: string;
  /** Text printed directly on the ground. */
  onCanvas: string;
  /** Card fill. */
  surface: string;
  /** Card hairline — cards on the dark preset are glass and need an edge. */
  cardBorder: string;
  /** Backdrop blur radius for cards, e.g. "18px" or "0px". */
  cardBlur: string;
  /** Nested row inside a card. */
  paper: string;
  /** Primary text, and the solid "contrast fill" behind on-ink text. */
  ink: string;
  /** Text printed on an ink fill. */
  onInk: string;
  inkBody: string;
  inkMuted: string;
  inkFaint: string;
  rule: string;
  ruleSoft: string;
  accent: string;
  accentStrong: string;
  onAccent: string;
  /** Accent used as text on a surface. */
  accentInk: string;
  /** Accent at low alpha — meter tracks, error rows, active cells. */
  tint: string;
  /** Secondary chip colour. */
  bench: string;
  blush: string;
  /** Availability "free", wins. */
  positive: string;
  /** Availability "maybe". */
  caution: string;
  /** Shadow used by floating overlays only. */
  shadow: string;
  /** Browser UI colour (`<meta name="theme-color">`). */
  themeColor: string;
}

export function buildPalette(appearance: Appearance): Palette {
  const accent = normalizeHex(appearance.accent) ?? DEFAULT_APPEARANCE.accent;

  if (appearance.preset === "sideline") {
    const surface = "#F1EFE8";
    return {
      canvas: "#8FA6BF",
      canvasImage: "none",
      onCanvas: "#FFFFFF",
      surface,
      cardBorder: "transparent",
      cardBlur: "0px",
      paper: "#FFFFFF",
      ink: "#17171A",
      onInk: "#FFFFFF",
      inkBody: "#3A3C41",
      inkMuted: "#5A5C61",
      inkFaint: "#8A8C91",
      rule: "#E7E5DD",
      ruleSoft: "#E2E0D8",
      accent,
      accentStrong: shade(accent, -0.15),
      onAccent: readableOn(accent),
      accentInk: accentOn(accent, surface),
      tint: alpha(accent, 0.14),
      bench: "#4E7CA8",
      blush: shade(accent, 0.45),
      positive: "#2F7D5B",
      caution: "#9A7220",
      shadow: "0 30px 80px rgba(23, 23, 26, 0.18)",
      themeColor: "#8FA6BF",
    };
  }

  // "court" — the dark ground. Surfaces are white at low alpha so they pick
  // up whatever is behind them, which is what makes the ground's gradient
  // read through the cards instead of being covered by them.
  const canvas = "#101218";
  return {
    canvas,
    canvasImage: [
      `radial-gradient(1100px 620px at 12% -8%, ${alpha(accent, 0.14)}, transparent 60%)`,
      "radial-gradient(950px 620px at 92% -4%, rgba(88, 101, 201, 0.18), transparent 55%)",
    ].join(", "),
    onCanvas: "#F4F5F7",
    surface: "rgba(255, 255, 255, 0.06)",
    cardBorder: "rgba(255, 255, 255, 0.11)",
    cardBlur: "18px",
    paper: "rgba(0, 0, 0, 0.22)",
    ink: "#F4F5F7",
    onInk: "#16181F",
    inkBody: "#B8BCC7",
    inkMuted: "#A4A9B6",
    inkFaint: "#7D8290",
    rule: "rgba(255, 255, 255, 0.11)",
    ruleSoft: "rgba(255, 255, 255, 0.07)",
    accent,
    accentStrong: shade(accent, -0.14),
    onAccent: readableOn(accent),
    // Cards are translucent, so measure the accent text against the ground
    // it actually ends up over rather than against the glass.
    accentInk: accentOn(accent, canvas),
    tint: alpha(accent, 0.16),
    bench: "#5865C9",
    blush: shade(accent, 0.35),
    positive: "#8FE0B4",
    caution: "#E8C887",
    shadow: "0 24px 60px rgba(0, 0, 0, 0.45)",
    themeColor: canvas,
  };
}

/**
 * The palette as a CSS custom-property block. These names shadow the ones
 * Tailwind's `@theme` emits on `:root`, so re-declaring them later in the
 * document restyles every utility class without a rebuild.
 */
export function paletteCss(p: Palette): string {
  const pairs: [string, string][] = [
    ["--color-canvas", p.canvas],
    ["--canvas-image", p.canvasImage],
    ["--color-on-canvas", p.onCanvas],
    ["--color-surface", p.surface],
    ["--card-border", p.cardBorder],
    ["--card-blur", p.cardBlur],
    ["--color-paper", p.paper],
    ["--color-ink", p.ink],
    ["--color-on-ink", p.onInk],
    ["--color-ink-body", p.inkBody],
    ["--color-ink-muted", p.inkMuted],
    ["--color-ink-faint", p.inkFaint],
    ["--color-rule", p.rule],
    ["--color-rule-soft", p.ruleSoft],
    ["--color-accent", p.accent],
    ["--color-accent-strong", p.accentStrong],
    ["--color-on-accent", p.onAccent],
    ["--color-accent-ink", p.accentInk],
    ["--color-tint", p.tint],
    ["--color-bench", p.bench],
    ["--color-blush", p.blush],
    ["--color-positive", p.positive],
    ["--color-caution", p.caution],
    ["--shadow-float", p.shadow],
  ];
  return pairs.map(([k, v]) => `${k}:${v}`).join(";");
}

/* -------------------------------- parsing --------------------------------- */

/**
 * Read an appearance out of a jsonb blob (league settings or a profile),
 * falling back field by field so a half-written value can't break a page.
 */
export function parseAppearance(
  raw: unknown,
  fallback: Appearance = DEFAULT_APPEARANCE,
): Appearance {
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as Record<string, unknown>;
  const preset =
    o.preset === "court" || o.preset === "sideline" ? o.preset : fallback.preset;
  const accent =
    typeof o.accent === "string"
      ? (normalizeHex(o.accent) ?? fallback.accent)
      : fallback.accent;
  return { preset, accent };
}
