/**
 * The floating tab bar — a standalone blurred pill hovering above the home
 * indicator, not a slab welded to the screen edge. Scrolling down shrinks it
 * to icons; any upward drag brings the labels back (see lib/scroll.ts for
 * the direction logic).
 *
 * This is the one place in the app allowed to cast a shadow: it floats.
 */

import { BlurView } from "expo-blur";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ReactNode } from "react";
import { barShrink } from "@/lib/scroll";

/**
 * Structurally typed rather than importing BottomTabBarProps: the package is
 * a transitive dependency of expo-router whose types aren't reliably
 * resolvable from here, and these five fields are the entire contract.
 */
interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<
    string,
    {
      options: {
        title?: string;
        tabBarIcon?: (p: { focused: boolean; color: string; size: number }) => ReactNode;
      };
    }
  >;
  navigation: {
    emit: (e: { type: "tabPress"; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
}
import { color, radius, shadowFloat, space } from "@/theme";

export function FloatingTabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  // Icon-only, per the v2 reference — the label's job is done by the active
  // dot. The shrink now just tightens the pill.
  const height = barShrink.interpolate({
    inputRange: [0, 1],
    outputRange: [58, 46],
  });

  return (
    <View
      pointerEvents="box-none"
      style={[s.wrap, { bottom: Math.max(insets.bottom, 12) + 4 }]}
    >
      <Animated.View style={[s.pill, shadowFloat, { height }]}>
        <BlurView tint="dark" intensity={40} style={StyleSheet.absoluteFill} />
        {/* The blur alone is too transparent over bright content — this scrim
            keeps the icons legible over a white card mid-scroll. */}
        <View style={[StyleSheet.absoluteFill, s.scrim]} />
        <View style={s.items}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const label = options.title ?? route.name;
            const focused = state.index === index;
            const tint = focused ? color.accent : color.inkFaint;

            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={label}
                onPress={() => {
                  const event = navigation.emit({
                    type: "tabPress",
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!focused && !event.defaultPrevented) {
                    navigation.navigate(route.name);
                  }
                }}
                style={s.item}
                hitSlop={6}
              >
                {options.tabBarIcon?.({ focused, color: tint, size: 23 })}
                <View
                  style={[
                    s.dot,
                    { backgroundColor: focused ? color.accent : "transparent" },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: space(2),
    right: space(2),
    alignItems: "center",
  },
  pill: {
    width: "100%",
    maxWidth: 430,
    borderRadius: radius.pill,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: color.glassBorder,
    justifyContent: "center",
  },
  scrim: { backgroundColor: "rgba(13,15,20,0.72)" },
  items: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space(1),
  },
  item: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
