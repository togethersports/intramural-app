import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Card, ErrorNote, Field, H2, Input, Notice } from "@/components/ui";
import { joinLeague } from "@/lib/data";
import { color, space, type } from "@/theme";

export default function Join() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (code.trim().length !== 6) {
      setError("Join codes are six characters. Check with your commissioner.");
      return;
    }
    setBusy(true);
    setError(null);
    const err = await joinLeague(code);
    setBusy(false);
    if (err) setError(err);
    else {
      setNotice("You're in.");
      setTimeout(() => router.replace("/(tabs)"), 700);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space(2), gap: space(2) }}>
      <Card style={{ gap: space(2) }}>
        <View>
          <H2>Join a league</H2>
          <Text style={[type.body, { color: color.inkBody, marginTop: 2 }]}>
            Enter the six-character code from your commissioner.
          </Text>
        </View>
        <ErrorNote message={error} />
        <Notice message={notice} />
        <Field label="Join code">
          <Input
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            placeholder="ABC123"
            style={{
              fontFamily: type.num.fontFamily, fontSize: 26,
              letterSpacing: 6, textAlign: "center",
            }}
            onSubmitEditing={submit}
          />
        </Field>
        <Button variant="accent" onPress={submit} loading={busy}>Join</Button>
      </Card>
    </ScrollView>
  );
}
