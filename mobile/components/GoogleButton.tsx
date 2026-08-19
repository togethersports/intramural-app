import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { ErrorNote } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { color, radius, space, type } from "@/theme";

/**
 * Google's four-colour "G" at its published proportions. It stays in its own
 * colours whatever the app's palette is — Google's brand guidelines require
 * that on any button carrying the word Google.
 */
function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17Z"
      />
      <Path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7A21.99 21.99 0 0 0 24 46Z"
      />
      <Path
        fill="#FBBC05"
        d="M11.69 28.18A13.2 13.2 0 0 1 11 24c0-1.45.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7Z"
      />
      <Path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07Z"
      />
    </Svg>
  );
}

export function GoogleButton({ label }: { label: string }) {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const press = async () => {
    setBusy(true);
    setError(await signInWithGoogle());
    setBusy(false);
  };

  return (
    <View style={{ gap: space(1.5) }}>
      <ErrorNote message={error} />
      <Pressable
        onPress={press}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => ({
          minHeight: 48,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: space(1),
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: color.rule,
          backgroundColor: color.paper,
          opacity: busy ? 0.5 : pressed ? 0.85 : 1,
        })}
      >
        <GoogleG />
        <Text style={[type.bodyMedium, { color: color.ink }]}>
          {busy ? "Opening Google…" : label}
        </Text>
      </Pressable>

      <View style={{ flexDirection: "row", alignItems: "center", gap: space(1.5) }}>
        <View style={{ flex: 1, height: 1, backgroundColor: color.rule }} />
        <Text style={[type.label, { color: color.inkFaint }]}>or with email</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: color.rule }} />
      </View>
    </View>
  );
}
