import { describe, expect, it } from "vitest";
import {
  DEFAULT_APPEARANCE,
  accentOn,
  alpha,
  buildPalette,
  contrast,
  normalizeHex,
  paletteCss,
  parseAppearance,
  parseHex,
  readableOn,
  shade,
} from "./theme";

describe("hex parsing", () => {
  it("accepts short and long form, with or without the hash", () => {
    expect(parseHex("#fff")).toEqual([255, 255, 255]);
    expect(parseHex("ff5c48")).toEqual([255, 92, 72]);
    expect(normalizeHex("#ff5c48")).toBe("#FF5C48");
    expect(normalizeHex("#f0a")).toBe("#FF00AA");
  });

  it("rejects anything that isn't a colour", () => {
    expect(parseHex("")).toBeNull();
    expect(parseHex("#12345")).toBeNull();
    expect(parseHex("javascript:alert(1)")).toBeNull();
    expect(normalizeHex("red")).toBeNull();
  });
});

describe("shading", () => {
  it("moves toward white and black", () => {
    expect(shade("#808080", 1)).toBe("#ffffff");
    expect(shade("#808080", -1)).toBe("#000000");
    expect(shade("#808080", 0)).toBe("#808080");
  });

  it("leaves an unparseable colour alone", () => {
    expect(shade("nope", 0.5)).toBe("nope");
  });
});

describe("alpha", () => {
  it("emits rgba", () => {
    expect(alpha("#FF5C48", 0.16)).toBe("rgba(255, 92, 72, 0.16)");
  });
});

describe("contrast", () => {
  it("is symmetric and bounded", () => {
    expect(contrast("#000", "#fff")).toBeCloseTo(21, 1);
    expect(contrast("#fff", "#000")).toBeCloseTo(21, 1);
    expect(contrast("#123456", "#123456")).toBeCloseTo(1, 5);
  });

  it("picks the readable text colour for a fill", () => {
    expect(readableOn("#101218")).toBe("#FFFFFF");
    expect(readableOn("#F1EFE8")).toBe("#16181F");
    // A mid coral is brighter than it looks — white still wins on it.
    expect(contrast("#FF5C48", readableOn("#FF5C48"))).toBeGreaterThan(
      contrast("#FF5C48", readableOn("#FF5C48") === "#FFFFFF" ? "#16181F" : "#FFFFFF"),
    );
  });
});

describe("accentOn", () => {
  it("lifts a dark accent until it is readable on a dark ground", () => {
    const out = accentOn("#1B2A6B", "#101218");
    expect(contrast(out, "#101218")).toBeGreaterThanOrEqual(4.5);
  });

  it("darkens a pale accent until it is readable on paper", () => {
    const out = accentOn("#FFE9A8", "#F1EFE8");
    expect(contrast(out, "#F1EFE8")).toBeGreaterThanOrEqual(4.5);
  });

  it("leaves an already-readable accent alone", () => {
    expect(accentOn("#C9242C", "#F1EFE8")).toBe("#C9242C");
  });
});

describe("buildPalette", () => {
  it("keeps body text readable on both presets", () => {
    for (const preset of ["court", "sideline"] as const) {
      const p = buildPalette({ preset, accent: "#FF5C48" });
      // inkBody sits on the card; on the dark preset the card is glass over
      // the ground, so measure against the ground.
      const behind = preset === "court" ? p.canvas : p.surface;
      expect(contrast(p.inkBody, behind)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.ink, behind)).toBeGreaterThanOrEqual(7);
    }
  });

  it("prints readable text on the accent whatever the accent is", () => {
    for (const accent of ["#FF5C48", "#FFE9A8", "#1B2A6B", "#3FA88A"]) {
      const p = buildPalette({ preset: "court", accent });
      expect(contrast(p.accent, p.onAccent)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("falls back to the default accent when given nonsense", () => {
    expect(buildPalette({ preset: "court", accent: "not a colour" }).accent).toBe(
      DEFAULT_APPEARANCE.accent,
    );
  });

  it("threads the accent through the ground gradient", () => {
    const p = buildPalette({ preset: "court", accent: "#3FA88A" });
    expect(p.canvasImage).toContain("63, 168, 138");
  });
});

describe("paletteCss", () => {
  it("emits every token as a custom property", () => {
    const css = paletteCss(buildPalette(DEFAULT_APPEARANCE));
    for (const name of [
      "--color-canvas",
      "--color-surface",
      "--color-ink",
      "--color-on-ink",
      "--color-accent",
      "--color-on-accent",
      "--card-blur",
    ]) {
      expect(css).toContain(`${name}:`);
    }
  });

  it("cannot be broken out of by a stored value", () => {
    // Accent is the only league-controlled field and it is hex-validated, so
    // no `}` or `<` can reach the emitted stylesheet.
    const css = paletteCss(
      buildPalette(parseAppearance({ preset: "court", accent: "#fff}</style><script>" })),
    );
    expect(css).not.toContain("<");
    expect(css).not.toContain("}");
  });
});

describe("parseAppearance", () => {
  it("defaults when there is nothing stored", () => {
    expect(parseAppearance(null)).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance({})).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance("court")).toEqual(DEFAULT_APPEARANCE);
  });

  it("keeps good fields and replaces bad ones", () => {
    expect(parseAppearance({ preset: "sideline", accent: "#3fa88a" })).toEqual({
      preset: "sideline",
      accent: "#3FA88A",
    });
    expect(parseAppearance({ preset: "neon", accent: "#3fa88a" })).toEqual({
      preset: "court",
      accent: "#3FA88A",
    });
    expect(parseAppearance({ preset: "sideline", accent: "nope" })).toEqual({
      preset: "sideline",
      accent: DEFAULT_APPEARANCE.accent,
    });
  });

  it("honours a caller-supplied fallback", () => {
    const league = { preset: "sideline", accent: "#C9242C" } as const;
    expect(parseAppearance(undefined, league)).toEqual(league);
  });
});
