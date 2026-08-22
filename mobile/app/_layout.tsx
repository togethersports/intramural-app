import { useEffect } from "react";
import { Pressable } from "react-native";
import { Stack, router, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useFonts } from "expo-font";
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
} from "@expo-google-fonts/outfit";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from "@expo-google-fonts/jetbrains-mono";
import { AuthProvider, useAuth } from "@/lib/auth";
import { loadCanvasChoice, useCanvas } from "@/lib/canvas";
import { loadActiveLeague } from "@/lib/active-league";
import { color } from "@/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});
loadCanvasChoice();
// Same reasoning: read the remembered league before the first paint, so the
// tabs do not flash the wrong one.
void loadActiveLeague();

function RootNavigator() {
  const { session, loading } = useAuth();
  const canvas = useCanvas();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!session && !inAuthGroup) router.replace("/(auth)/sign-in");
    else if (session && inAuthGroup) router.replace("/(tabs)");
  }, [session, loading, segments, router]);

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: canvas.base },
        headerTintColor: color.white,
        headerTitleStyle: { fontFamily: "Outfit_600SemiBold", fontSize: 18 },
        headerShadowVisible: false,
        // Our own back control, not the system one: iOS 26 draws the native
        // button as a filled glass pill that fights the dark headers, and
        // its label was the route name or the word "Back" — neither of which
        // says anything the arrow does not.
        headerBackVisible: false,
        headerLeft: () => <BackButton />,
        // Solid, not transparent: native-stack screens are hoisted into the
        // window's own view hierarchy, so a "transparent" scene reveals the
        // white iOS window — not any React view rendered behind the Stack.
        // The glow layer lives inside the tab and auth trees instead.
        contentStyle: { backgroundColor: canvas.base },
      }}
    >
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="game/[id]" options={{ title: "Game" }} />
      <Stack.Screen name="league/rules" options={{ title: "Rules" }} />
      <Stack.Screen name="league/stats" options={{ title: "Full stats" }} />
      <Stack.Screen name="league/edit-profile" options={{ title: "Edit profile" }} />
      <Stack.Screen name="league/availability" options={{ title: "Availability" }} />
      <Stack.Screen name="league/announce" options={{ title: "Announce" }} />
      <Stack.Screen name="league/new-game" options={{ title: "New game" }} />
      <Stack.Screen name="league/teams" options={{ title: "Teams" }} />
      <Stack.Screen name="league/player/[id]" options={{ title: "Player" }} />
      <Stack.Screen name="league/draft" options={{ title: "Draft" }} />
      <Stack.Screen name="league/trades" options={{ title: "Trades" }} />
      <Stack.Screen name="league/playoffs" options={{ title: "Playoffs" }} />
      <Stack.Screen name="league/members" options={{ title: "Members" }} />
      <Stack.Screen name="join" options={{ title: "Join a league" }} />
    </Stack>
  );
}

/** The back control: the chevron, in the running ink, and nothing else. */
function BackButton() {
  if (!router.canGoBack()) return null;
  return (
    <Pressable
      onPress={() => router.back()}
      hitSlop={12}
      accessibilityLabel="Back"
      accessibilityRole="button"
      style={{ paddingRight: 8, paddingVertical: 4 }}
    >
      <Svg width={26} height={26} viewBox="0 0 24 24">
        <Path
          d="M15 5 8 12l7 7"
          stroke={color.ink}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </Pressable>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  // Render nothing until the brand faces are ready — a flash of system font
  // then Outfit is worse than a beat longer on the splash.
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
