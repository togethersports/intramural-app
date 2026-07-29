import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { HIT, color, radius, shadowFloat, space, type } from "@/theme";

/* ---------------------------------- Card ----------------------------------
   Cream, flat. Shadow only on floating overlays (brandbook 06). */

export function Card({
  children,
  style,
  floating = false,
}: {
  children: ReactNode;
  style?: ViewStyle;
  floating?: boolean;
}) {
  return (
    <View style={[s.card, floating && shadowFloat, style]}>{children}</View>
  );
}

/** Paper-white nested row inside a cream card. */
export function Row({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[s.row, style]}>{children}</View>;
}

/* --------------------------------- Typography ------------------------------ */

export const H1 = ({ children, style }: { children: ReactNode; style?: object }) => (
  <Text style={[type.h1, { color: color.ink }, style]}>{children}</Text>
);
export const H2 = ({ children, style }: { children: ReactNode; style?: object }) => (
  <Text style={[type.h2, { color: color.ink }, style]}>{children}</Text>
);
export const Body = ({ children, style }: { children: ReactNode; style?: object }) => (
  <Text style={[type.body, { color: color.inkBody }, style]}>{children}</Text>
);
/** The mono eyebrow. */
export const Label = ({ children, style }: { children: ReactNode; style?: object }) => (
  <Text style={[type.label, style]}>{children}</Text>
);
/** Anything counted. */
export const Num = ({
  children,
  size = 17,
  style,
}: {
  children: ReactNode;
  size?: number;
  style?: object;
}) => (
  <Text style={[type.num, { fontSize: size, color: color.ink }, style]}>
    {children}
  </Text>
);

/* --------------------------------- Button ----------------------------------
   999px pill, 14/24 padding. ONE red button per screen — `accent` is the
   single defining action. On Court Blue, secondary is 22% white. */

type Variant = "accent" | "primary" | "light" | "quiet" | "canvas";

const VARIANT: Record<Variant, { bg: string; fg: string }> = {
  accent: { bg: color.accent, fg: color.white },
  primary: { bg: color.ink, fg: color.white },
  light: { bg: color.paper, fg: color.ink },
  quiet: { bg: color.rule, fg: color.ink },
  canvas: { bg: "rgba(255,255,255,0.22)", fg: color.white },
};

export function Button({
  children,
  onPress,
  variant = "primary",
  disabled,
  loading,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const v = VARIANT[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.button,
        { backgroundColor: v.bg, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <Text style={[s.buttonText, { color: v.fg }]}>{children}</Text>
      )}
    </Pressable>
  );
}

/* ---------------------------------- Chips ---------------------------------- */

/** Slot / tag chip — Bench Blue. */
export const Chip = ({ children }: { children: ReactNode }) => (
  <View style={s.chip}>
    <Text style={s.chipText}>{children}</Text>
  </View>
);

/** Stat-action chip — Night Court, mono. */
export const StatChip = ({ children }: { children: ReactNode }) => (
  <View style={s.chipStat}>
    <Text style={s.chipStatText}>{children}</Text>
  </View>
);

/* ---------------------------------- Input ---------------------------------- */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Label>{label}</Label>
      {children}
      {hint ? (
        <Text style={[type.small, { color: color.inkMuted }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={color.inkFaint}
      {...props}
      style={[s.input, props.style]}
    />
  );
}

/* --------------------------------- Feedback -------------------------------- */

/** Errors name the fix (brandbook 07). */
export function ErrorNote({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View style={s.error} accessibilityRole="alert">
      <Text style={[type.body, { color: color.accent }]}>{message}</Text>
    </View>
  );
}

export function Notice({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View style={s.notice}>
      <Text style={[type.body, { color: color.white }]}>{message}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <View style={s.empty}>
      <Text style={[type.h2, { color: color.ink }]}>{title}</Text>
      {body ? (
        <Text style={[type.body, { color: color.inkBody, maxWidth: 420 }]}>
          {body}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

/* -------------------------------- Identity --------------------------------- */

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color.ink,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontFamily: type.bodyMedium.fontFamily,
          fontSize: size * 0.36,
          color: color.white,
        }}
      >
        {initials || "—"}
      </Text>
    </View>
  );
}

/** The ONLY place a team's colour is allowed, with bracket rows. */
export function TeamBadge({
  abbrev,
  teamColor,
  size = 28,
}: {
  abbrev: string;
  teamColor: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        backgroundColor: teamColor,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontFamily: type.bodyMedium.fontFamily,
          fontSize: size * 0.36,
          color: color.white,
        }}
      >
        {abbrev.slice(0, 3).toUpperCase()}
      </Text>
    </View>
  );
}

/* ---------------------------------- Meter ---------------------------------- */

export function Meter({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <View style={s.meterTrack}>
      <View style={[s.meterFill, { width: `${pct}%` }]} />
    </View>
  );
}

/** Horizontal scroller for wide data, with the same containment as web. */
export function HScroll({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingRight: space(2) }}
    >
      {children}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.card,
    padding: space(2.5),
  },
  row: {
    backgroundColor: color.paper,
    borderRadius: radius.row,
    padding: space(1.75),
  },
  button: {
    minHeight: HIT,
    borderRadius: radius.pill,
    paddingHorizontal: space(3),
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: space(1),
  },
  buttonText: { fontFamily: type.bodyMedium.fontFamily, fontSize: 17 },
  chip: {
    backgroundColor: color.bench,
    borderRadius: radius.pill,
    paddingHorizontal: space(1.75),
    paddingVertical: space(1),
    alignSelf: "flex-start",
  },
  chipText: { fontFamily: type.bodyMedium.fontFamily, fontSize: 15, color: color.white },
  chipStat: {
    backgroundColor: color.ink,
    borderRadius: radius.pill,
    paddingHorizontal: space(2),
    paddingVertical: space(1.25),
    alignItems: "center",
    justifyContent: "center",
    minHeight: HIT,
    flex: 1,
  },
  chipStatText: { fontFamily: type.num.fontFamily, fontSize: 14, color: color.white },
  input: {
    minHeight: HIT,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: color.rule,
    backgroundColor: color.paper,
    paddingHorizontal: space(2),
    fontFamily: type.body.fontFamily,
    fontSize: 17,
    color: color.ink,
  },
  error: {
    backgroundColor: color.tint,
    borderRadius: radius.row,
    padding: space(1.75),
  },
  notice: {
    backgroundColor: color.ink,
    borderRadius: radius.row,
    padding: space(1.75),
  },
  empty: {
    backgroundColor: color.paper,
    borderRadius: radius.panel,
    padding: space(3),
    gap: space(1.5),
    alignItems: "flex-start",
  },
  meterTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: color.tint,
    overflow: "hidden",
  },
  meterFill: { height: 8, borderRadius: radius.pill, backgroundColor: color.accent },
});
