import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Link } from "expo-router";
import { GoogleButton } from "@/components/GoogleButton";
import { Mark } from "@/components/Mark";
import { Button, Card, ErrorNote, Field, Input } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import { color, space, type } from "@/theme";

export default function SignIn() {
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(await signIn(email, password));
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          padding: space(2.5),
          paddingTop: insets.top + space(3),
          paddingBottom: insets.bottom + space(3),
          gap: space(3),
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: "center", gap: space(1.5) }}>
          <View
            style={{
              width: 74,
              height: 74,
              borderRadius: 24,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.10)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.16)",
            }}
          >
            <Mark size={40} tone="white-red" />
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={[type.h1, { fontSize: 27, color: color.ink }]}>Intramural</Text>
            <Text style={[type.small, { color: color.inkMuted, marginTop: 3 }]}>
              Your school league, in your pocket.
            </Text>
          </View>
        </View>

        <Card style={{ gap: space(2) }}>
          {!isSupabaseConfigured() ? (
            <ErrorNote message="The backend isn't configured in this build. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY." />
          ) : null}
          <ErrorNote message={error} />
          <GoogleButton label="Continue with Google" />
          <Field label="Email">
            <Input
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@school.org"
              returnKeyType="next"
            />
          </Field>
          <Field label="Password">
            <Input
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              placeholder="••••••••"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
          </Field>
          <Button variant="accent" onPress={submit} loading={busy}>
            Sign in
          </Button>
          <Link href="/(auth)/sign-up" asChild>
            <Pressable style={{ minHeight: 44, justifyContent: "center" }}>
              <Text style={[type.body, { color: color.inkBody }]}>
                No account yet?{" "}
                <Text style={{ fontFamily: type.bodyMedium.fontFamily, color: color.ink }}>
                  Create one
                </Text>
              </Text>
            </Pressable>
          </Link>
        </Card>

        <Text style={[type.small, { color: color.inkFaint, textAlign: "center" }]}>
          Built for lunch periods everywhere.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
