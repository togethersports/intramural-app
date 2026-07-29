import Svg, { G, Path } from "react-native-svg";
import { Text, View } from "react-native";
import { color, font } from "@/theme";

/*
  The Bracket — same construction as the web mark (components/mark.tsx).
  64 x 64 grid, seeds in at y18 / y46, connector, one line out at y32 in
  Whistle Red. Stroke 6, round caps. Below 20px the red line is dropped.
*/

type MarkTone = "ink" | "white" | "white-red" | "red";

const STROKE: Record<MarkTone, { line: string; output: string }> = {
  ink: { line: color.ink, output: color.accent },
  "white-red": { line: color.white, output: color.accent },
  white: { line: color.white, output: color.white },
  red: { line: color.accent, output: color.accent },
};

export function Mark({
  size = 32,
  tone = "ink",
}: {
  size?: number;
  tone?: MarkTone;
}) {
  const { line, output } = STROKE[tone];
  const outputStroke = size < 20 ? line : output;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <G stroke={line} strokeWidth={6} strokeLinecap="round" fill="none">
        <Path d="M10 18h22" />
        <Path d="M10 46h22" />
        <Path d="M32 18v28" />
      </G>
      <Path
        d="M32 32h22"
        stroke={outputStroke}
        strokeWidth={6}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/** Mark + wordmark. Text is 0.53x mark width, gap 0.28x (brandbook 03). */
export function Lockup({
  size = 40,
  tone = "ink",
}: {
  size?: number;
  tone?: MarkTone;
}) {
  const onDark = tone === "white" || tone === "white-red";
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: size * 0.28 }}
    >
      <Mark size={size} tone={tone} />
      <Text
        style={{
          fontFamily: font.semibold,
          fontSize: size * 0.53,
          letterSpacing: -size * 0.53 * 0.02,
          color: onDark ? color.white : color.ink,
        }}
      >
        Intramural
      </Text>
    </View>
  );
}
