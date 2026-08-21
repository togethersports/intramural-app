import { Stack } from "expo-router";
import { useCanvas } from "@/lib/canvas";

/**
 * The auth group's own navigator. Without this file it exists implicitly —
 * with default headers, which printed the route name ("sign-in") in a bar
 * across the top of the sign-in screen. The screens are self-contained
 * full-bleed layouts; no chrome belongs above them.
 */
export default function AuthLayout() {
  const canvas = useCanvas();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Solid: a "transparent" native-stack scene shows the white window.
        contentStyle: { backgroundColor: canvas.base },
      }}
    />
  );
}
