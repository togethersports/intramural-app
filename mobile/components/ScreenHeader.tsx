/**
 * The header every screen shares: the Bracket mark, then who and where you
 * are — real names, never a route label. The right slot takes whatever the
 * screen needs there: a role chip, the user's face, nothing.
 */
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Mark } from "./Mark";
import { color, space, type } from "@/theme";

export function ScreenHeader({
  title,
  subtitle,
  right,
  onPressTitle,
}: {
  title: string;
  subtitle?: string | null;
  right?: ReactNode;
  /** Set when the title is a switch — the league picker, today. */
  onPressTitle?: () => void;
}) {
  const Name = onPressTitle ? Pressable : View;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space(1.5),
        paddingHorizontal: 2,
      }}
    >
      <Mark size={22} tone="ink" />
      <Name
        onPress={onPressTitle}
        hitSlop={onPressTitle ? 8 : undefined}
        style={{ flex: 1, minWidth: 0 }}
      >
        <Text
          numberOfLines={1}
          style={{
            fontFamily: type.h2.fontFamily,
            fontSize: 17,
            letterSpacing: -0.3,
            color: color.ink,
          }}
        >
          {title}
          {onPressTitle ? "  ▾" : ""}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={[type.small, { fontSize: 12.5, color: color.inkFaint }]}>
            {subtitle}
          </Text>
        ) : null}
      </Name>
      {right}
    </View>
  );
}

/** The little status chip on the header's right — "Player", "Commish". */
export function RoleChip({ role }: { role: string }) {
  const label = role === "commissioner" ? "Commish" : role.charAt(0).toUpperCase() + role.slice(1);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 11,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: "rgba(91,211,154,0.12)",
        borderWidth: 1,
        borderColor: "rgba(91,211,154,0.26)",
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color.positive }} />
      <Text style={[type.small, { fontSize: 12, color: color.positive }]}>{label}</Text>
    </View>
  );
}
