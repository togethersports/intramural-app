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
import {
  Button,
  Card,
  ErrorNote,
  Field,
  H1,
  Input,
  Notice,
} from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { color, space, type } from "@/theme";

export default function SignUp() {
  const { signUp } = useAuth();
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState("");
  const [grade, setGrade] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const res = await signUp(fullName, email, password, grade);
    setError(res.error);
    setNotice(res.notice);
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
          <View>
            <H1>Create your account</H1>
            <Text style={[type.body, { color: color.inkBody, marginTop: 4 }]}>
              Name, email, grade — that&apos;s all we collect.
            </Text>
          </View>
          <ErrorNote message={error} />
          <Notice message={notice} />
          <Field label="Full name">
            <Input
              value={fullName}
              onChangeText={setFullName}
              autoComplete="name"
              placeholder="Jordan Cohen"
            />
          </Field>
          <Field label="Grade" hint="Optional.">
            <Input
              value={grade}
              onChangeText={setGrade}
              keyboardType="number-pad"
              placeholder="11"
              maxLength={2}
            />
          </Field>
          <Field label="Email">
            <Input
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@school.org"
            />
          </Field>
          <Field label="Password" hint="At least 8 characters.">
            <Input
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              placeholder="••••••••"
              onSubmitEditing={submit}
            />
          </Field>
          <Button variant="accent" onPress={submit} loading={busy}>
            Create account
          </Button>
          <Link href="/(auth)/sign-in" asChild>
            <Pressable style={{ minHeight: 44, justifyContent: "center" }}>
              <Text style={[type.body, { color: color.inkBody }]}>
                Already have an account?{" "}
                <Text style={{ fontFamily: type.bodyMedium.fontFamily, color: color.ink }}>
                  Sign in
                </Text>
              </Text>
            </Pressable>
          </Link>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
