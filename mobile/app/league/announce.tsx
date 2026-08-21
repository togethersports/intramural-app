/**
 * The commissioner's megaphone, from the phone.
 *
 * Posting goes through the web API rather than Supabase directly, because
 * the announcement is three deliveries — the record, every inbox, and a
 * push to every registered device — and only the server holds the APNs key
 * for that last one. The server re-checks that this account is a league
 * admin; this screen appearing at all is a convenience, not the guard.
 */
import { useState } from "react";
import { ScrollView, Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Button, Card, ErrorNote, Field, H1, Input, Notice } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { color, space, type } from "@/theme";

const SITE = process.env.EXPO_PUBLIC_SITE_URL ?? "https://www.intramural.app";

export default function Announce() {
  const { session } = useAuth();
  const params = useLocalSearchParams<{ leagueId: string; leagueName: string }>();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function post() {
    if (!session || !params.leagueId) return;
    if (!title.trim()) {
      setError("Give the announcement a title.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${SITE}/api/announce`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          leagueId: params.leagueId,
          title: title.trim(),
          body: body.trim(),
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        delivered?: number;
      };
      if (!json.ok) {
        setError(json.error ?? "Couldn't post it. Try again.");
        return;
      }
      setNotice(
        json.delivered && json.delivered > 0
          ? `Posted. Buzzed ${json.delivered} device${json.delivered === 1 ? "" : "s"}.`
          : "Posted to everyone's inbox.",
      );
      setTitle("");
      setBody("");
      setTimeout(() => router.back(), 900);
    } catch {
      setError("Couldn't reach the server. Check your connection.");
    } finally {
      setPending(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: color.canvas }}
      contentContainerStyle={{ padding: space(2.5), gap: space(2) }}
      keyboardShouldPersistTaps="handled"
    >
      <H1>Announcement</H1>
      <Text style={[type.small, { color: color.inkMuted }]}>
        {params.leagueName ?? "Your league"} — lands in every member&apos;s
        inbox and buzzes every phone and watch with the app.
      </Text>
      <Card style={{ gap: space(2) }}>
        <ErrorNote message={error} />
        <Notice message={notice} />
        <Field label="Title">
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder="Games cancelled today"
            maxLength={120}
            autoFocus
          />
        </Field>
        <Field label="Details (optional)">
          <Input
            value={body}
            onChangeText={setBody}
            placeholder="Main Gym is closed for the assembly."
            maxLength={2000}
            multiline
            numberOfLines={4}
            style={{ minHeight: 96, textAlignVertical: "top" }}
          />
        </Field>
        <Button variant="accent" onPress={post} disabled={pending}>
          {pending ? "Posting…" : "Post to the whole league"}
        </Button>
      </Card>
    </ScrollView>
  );
}
