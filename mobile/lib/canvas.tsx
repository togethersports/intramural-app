/**
 * The canvas system — what sits behind the glass.
 *
 * Cards keep the same geometry everywhere; the only variable is the ground
 * behind them (the design reference's 1a/1b/1c). Each preset is a base tone
 * plus two soft radial glows, drawn once as an absolutely-positioned SVG —
 * React Native has no CSS radial-gradient, but react-native-svg's
 * RadialGradient is exactly that.
 *
 * The choice is per-person and survives reinstalls the cheap way:
 * AsyncStorage, read once at launch. Module-level store with subscribers
 * rather than context, because the background sits *outside* the navigators
 * and a context provider would have to wrap them all to reach it.
 */

import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";

export type CanvasId = "midnight" | "indigo" | "dusk";

interface Glow {
  /** Center and radii in percent of the screen. */
  cx: string;
  cy: string;
  rx: string;
  ry: string;
  color: string;
  opacity: number;
}

export interface CanvasPreset {
  id: CanvasId;
  name: string;
  /** The base tone the glows sit on. */
  base: string;
  glows: Glow[];
}

export const CANVASES: CanvasPreset[] = [
  {
    id: "midnight",
    name: "Midnight",
    base: "#0A0B10",
    glows: [
      { cx: "50%", cy: "8%", rx: "60%", ry: "36%", color: "#FF5C48", opacity: 0.14 },
      { cx: "10%", cy: "96%", rx: "50%", ry: "38%", color: "#5865C9", opacity: 0.12 },
    ],
  },
  {
    id: "indigo",
    name: "Indigo",
    base: "#0C0F1D",
    glows: [
      { cx: "40%", cy: "0%", rx: "75%", ry: "42%", color: "#5865C9", opacity: 0.26 },
      { cx: "92%", cy: "30%", rx: "45%", ry: "34%", color: "#FF5C48", opacity: 0.1 },
    ],
  },
  {
    id: "dusk",
    name: "Dusk",
    base: "#120D0A",
    glows: [
      { cx: "60%", cy: "20%", rx: "70%", ry: "46%", color: "#C47846", opacity: 0.2 },
      { cx: "15%", cy: "90%", rx: "50%", ry: "36%", color: "#FF5C48", opacity: 0.1 },
    ],
  },
];

const KEY = "canvas";
let current: CanvasId = "midnight";
const listeners = new Set<() => void>();

/** Called once from the root layout, before anything renders behind it. */
export async function loadCanvasChoice(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(KEY);
    if (stored && CANVASES.some((c) => c.id === stored)) {
      current = stored as CanvasId;
      listeners.forEach((l) => l());
    }
  } catch {
    // First launch, or storage unavailable — the default stands.
  }
}

export function setCanvasChoice(id: CanvasId): void {
  current = id;
  listeners.forEach((l) => l());
  AsyncStorage.setItem(KEY, id).catch(() => {});
}

export function useCanvas(): CanvasPreset {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return CANVASES.find((c) => c.id === current) ?? CANVASES[0];
}

/** The ground. Mount once per navigator tree, behind transparent scenes. */
export function CanvasBackground() {
  const preset = useCanvas();
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: preset.base }]}
    >
      <Svg width="100%" height="100%">
        <Defs>
          {preset.glows.map((g, i) => (
            <RadialGradient key={i} id={`glow${i}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={g.color} stopOpacity={g.opacity} />
              <Stop offset="1" stopColor={g.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {preset.glows.map((g, i) => (
          <Ellipse
            key={i}
            cx={g.cx}
            cy={g.cy}
            rx={g.rx}
            ry={g.ry}
            fill={`url(#glow${i})`}
          />
        ))}
      </Svg>
    </View>
  );
}
