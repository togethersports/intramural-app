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
import { Lockup } from "@/components/Mark";
import { Button, Card, ErrorNote, Field, H1, Input } from "@/components/ui";
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
      style={{ flex: 1, backgroundColor: color.canvas }}
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
        <View style={{ alignItems: "center" }}>
          <Lockup size={40} tone="white-red" />
        </View>

        <Card style={{ gap: space(2) }}>
          <H1>Sign in</H1>
          {!isSupabaseConfigured() ? (
            <ErrorNote message="The backend isn't configured in this build. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY." />
          ) : null}
          <ErrorNote message={error} />
          <Field label="School email">
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

        <Text
          style={[type.body, { color: color.white, textAlign: "center" }]}
        >
          Built for lunch periods everywhere.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
