"use client";

import { useState } from "react";
import {
  ACCENT_CHOICES,
  THEME_PRESETS,
  buildPalette,
  normalizeHex,
  type ThemePreset,
} from "@core/theme";

/**
 * The colour editor, used by a commissioner for the whole league and by a
 * person for themselves. It previews live: the swatch block below the
 * controls is drawn with the palette the choice actually produces, including
 * the contrast-corrected text colours, so nobody has to save to find out that
 * their accent is unreadable.
 *
 * Emits two form fields, `preset` and `accent` — the parent owns the submit.
 */
export function AppearancePicker({
  defaultPreset,
  defaultAccent,
}: {
  defaultPreset: ThemePreset;
  defaultAccent: string;
}) {
  const [preset, setPreset] = useState<ThemePreset>(defaultPreset);
  const [accent, setAccent] = useState(defaultAccent);

  const valid = normalizeHex(accent);
  const palette = buildPalette({ preset, accent: valid ?? defaultAccent });

  return (
    <div className="space-y-5">
      <input type="hidden" name="preset" value={preset} />
      <input type="hidden" name="accent" value={valid ?? defaultAccent} />

      <div>
        <p className="label mb-2 !text-[11px]">Theme</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {THEME_PRESETS.map((p) => {
            const swatch = buildPalette({
              preset: p.id,
              accent: valid ?? defaultAccent,
            });
            const on = preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                aria-pressed={on}
                className={
                  on
                    ? "flex min-h-11 items-center gap-3 rounded-panel border-2 border-accent bg-paper p-3 text-left"
                    : "flex min-h-11 items-center gap-3 rounded-panel border-2 border-rule bg-paper p-3 text-left transition-colors hover:border-ink-faint"
                }
              >
                <span
                  aria-hidden
                  className="grid size-10 shrink-0 place-items-center rounded-[10px]"
                  style={{ backgroundColor: swatch.canvas }}
                >
                  <span
                    className="size-5 rounded-[5px]"
                    style={{ backgroundColor: swatch.accent }}
                  />
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold">{p.name}</span>
                  <span className="block truncate text-[13px] text-ink-body">
                    {p.note}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="label mb-2 !text-[11px]">Accent</p>
        <div className="flex flex-wrap gap-2">
          {ACCENT_CHOICES.map((c) => {
            const on = (valid ?? "").toUpperCase() === c.hex.toUpperCase();
            return (
              <button
                key={c.hex}
                type="button"
                onClick={() => setAccent(c.hex)}
                aria-label={c.name}
                aria-pressed={on}
                title={c.name}
                className={
                  on
                    ? "size-11 rounded-full ring-2 ring-ink ring-offset-2 ring-offset-surface"
                    : "size-11 rounded-full transition-transform hover:scale-105"
                }
                style={{ backgroundColor: c.hex }}
              />
            );
          })}
        </div>
        <label className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-[15px] text-ink-body">Or any colour</span>
          <input
            type="color"
            value={valid ?? defaultAccent}
            onChange={(e) => setAccent(e.target.value)}
            aria-label="Custom accent colour"
            className="h-11 w-16 cursor-pointer rounded-control border border-rule bg-paper p-1"
          />
          <input
            type="text"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            aria-label="Accent hex code"
            spellCheck={false}
            className="num h-11 w-32 rounded-control border border-rule bg-paper px-3 text-[15px] uppercase"
          />
          {!valid ? (
            <span className="text-[13px] font-medium text-accent-ink">
              Needs six hex digits, like #FF5C48.
            </span>
          ) : null}
        </label>
      </div>

      {/* Live preview, drawn with the palette the choice produces. */}
      <div
        className="rounded-panel p-4"
        style={{
          backgroundColor: palette.canvas,
          backgroundImage: palette.canvasImage,
        }}
      >
        <div
          className="rounded-panel p-4"
          style={{
            backgroundColor: palette.surface,
            border: `1px solid ${palette.cardBorder}`,
            color: palette.ink,
          }}
        >
          <p
            className="label !text-[10px]"
            style={{ color: palette.inkFaint }}
          >
            Preview · Week 5
          </p>
          <p className="mt-1 text-[17px] font-semibold">Panthers vs Comets</p>
          <p className="text-[14px]" style={{ color: palette.inkBody }}>
            Period 4 Lunch · Main Gym
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex min-h-9 items-center rounded-full px-4 text-[14px] font-semibold"
              style={{ backgroundColor: palette.accent, color: palette.onAccent }}
            >
              Start game
            </span>
            <span
              className="inline-flex min-h-9 items-center rounded-full px-4 text-[14px] font-semibold"
              style={{ backgroundColor: palette.ink, color: palette.onInk }}
            >
              Box score
            </span>
            <span
              className="text-[14px] font-semibold"
              style={{ color: palette.accentInk }}
            >
              2 need you
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
