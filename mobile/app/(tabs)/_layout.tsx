import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { View } from "react-native";
import { FloatingTabBar } from "@/components/FloatingTabBar";
import { CanvasBackground, useCanvas } from "@/lib/canvas";
import { Avatar } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useMyIdentity } from "@/lib/profile";

/* Icons match the web set: 1.5px stroke, round caps, currentColor. */
const stroke = (c: ColorValue) => ({
  stroke: c,
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  fill: "none",
});

const IconHome = ({ c }: { c: ColorValue }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24">
    <Path d="M3.5 10.5 12 4l8.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-3.5v-6h-7v6H5A1.5 1.5 0 0 1 3.5 19z" {...stroke(c)} />
  </Svg>
);
const IconCalendar = ({ c }: { c: ColorValue }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24">
    <Rect x={3.5} y={5} width={17} height={15.5} rx={2.5} {...stroke(c)} />
    <Path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" {...stroke(c)} />
  </Svg>
);
const IconTrophy = ({ c }: { c: ColorValue }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24">
    <Path d="M7 4h10v5a5 5 0 0 1-10 0z" {...stroke(c)} />
    <Path d="M7 5.5H4.5V7A3.5 3.5 0 0 0 7 10.3M17 5.5h2.5V7A3.5 3.5 0 0 1 17 10.3M12 14v3.5M8.5 20.5h7" {...stroke(c)} />
  </Svg>
);
const IconBell = ({ c }: { c: ColorValue }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24">
    <Path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5H5S6.5 14 6.5 10z" {...stroke(c)} />
    <Path d="M10 19a2 2 0 0 0 4 0" {...stroke(c)} />
  </Svg>
);
const IconUser = ({ c }: { c: ColorValue }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24">
    <Circle cx={12} cy={8} r={3.75} {...stroke(c)} />
    <Path d="M4.5 20c1.2-3.4 4-5.2 7.5-5.2s6.3 1.8 7.5 5.2" {...stroke(c)} />
  </Svg>
);

export default function TabsLayout() {
  const { user } = useAuth();
  const me = useMyIdentity(user?.id);
  const canvas = useCanvas();
  return (
    <View style={{ flex: 1, backgroundColor: canvas.base }}>
      <CanvasBackground />
      <Tabs
      // The bar floats over content instead of claiming a slab of screen —
      // every scrolling screen pads its bottom by TAB_CLEARANCE instead.
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        // Each tab draws its own identity header, per the reference — a
        // centered native header on top of that would say everything twice.
        headerShown: false,
        // Transparent so the shared CanvasBackground shows through.
        sceneStyle: { backgroundColor: "transparent" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color: c }) => <IconHome c={c} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Schedule",
          tabBarIcon: ({ color: c }) => <IconCalendar c={c} />,
        }}
      />
      <Tabs.Screen
        name="standings"
        options={{
          title: "League",
          tabBarIcon: ({ color: c }) => <IconTrophy c={c} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
          tabBarIcon: ({ color: c }) => <IconBell c={c} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Me",
          // The design's fifth tab is *you* — the face, not a glyph. Falls
          // back to initials, and to the glyph before the profile loads.
          tabBarIcon: ({ color: c }) =>
            me ? (
              <Avatar name={me.name || "?"} size={26} uri={me.avatarUrl} />
            ) : (
              <IconUser c={c} />
            ),
        }}
      />
      </Tabs>
    </View>
  );
}
