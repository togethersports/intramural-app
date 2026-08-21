import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Lockup } from "@/components/Mark";
import { Avatar, Button, Card, ErrorNote, H2, Label } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { getMyLeagues, type LeagueSummary } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { TAB_CLEARANCE, useBarScroll } from "@/lib/scroll";
import { CANVASES, setCanvasChoice, useCanvas } from "@/lib/canvas";
import { useMyIdentity } from "@/lib/profile";
import { color, space, type } from "@/theme";

export default function Profile() {
  const { user, signOut, deleteAccount } = useAuth();
  const router = useRouter();
  const onScroll = useBarScroll();
  const canvas = useCanvas();
  const me = useMyIdentity(user?.id);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data }, ls] = await Promise.all([
      supabase.from("profiles").select("full_name, grade").eq("id", user.id).maybeSingle(),
      getMyLeagues(),
    ]);
    setName((data?.full_name as string) ?? "");
    setGrade((data?.grade as number) ?? null);
    setLeagues(ls);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  /* App Store Guideline 5.1.1(v): account deletion must be reachable
     in-app, not just on a website. Two-step so it can't be a fat-finger. */
  const confirmDelete = () => {
    Alert.alert(
      "Delete your account?",
      "This removes your profile, league memberships and personal stat lines. Team results stay on the record. This cannot be undone.",
      [
        { text: "Keep my account", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const err = await deleteAccount();
            if (err) setError(err);
            else router.replace("/(auth)/sign-in");
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      onScroll={onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{ padding: space(2), gap: space(2), paddingBottom: TAB_CLEARANCE }}
    >
      <Card style={{ gap: space(2) }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space(2) }}>
          <Avatar name={name || "?"} size={56} uri={me?.avatarUrl} />
          <View style={{ flex: 1 }}>
            <Text style={[type.h2, { color: color.ink }]} numberOfLines={1}>
              {name || "Your profile"}
            </Text>
            <Text style={[type.small, { color: color.inkMuted }]}>
              {user?.email}
              {grade ? ` · Grade ${grade}` : ""}
            </Text>
          </View>
        </View>
      </Card>

      <Card style={{ gap: space(1.5) }}>
        <H2>My leagues</H2>
        {leagues.length === 0 ? (
          <Text style={[type.body, { color: color.inkFaint }]}>Not in a league yet.</Text>
        ) : (
          leagues.map((l) => (
            <View key={l.id} style={{ flexDirection: "row", alignItems: "center", gap: space(1.5) }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: l.primary_color }} />
              <View style={{ flex: 1 }}>
                <Text style={[type.bodyMedium, { color: color.ink }]} numberOfLines={1}>{l.name}</Text>
                <Label>{l.role}</Label>
              </View>
              {l.role === "commissioner" || l.role === "admin" ? (
                <Pressable
                  hitSlop={8}
                  onPress={() =>
                    router.push({
                      pathname: "/league/announce",
                      params: { leagueId: l.id, leagueName: l.name },
                    })
                  }
                  style={{
                    borderRadius: 999,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    backgroundColor: color.paper,
                  }}
                >
                  <Text style={[type.small, { color: color.ink, fontWeight: "600" }]}>Announce</Text>
                </Pressable>
              ) : null}
            </View>
          ))
        )}
        <Button variant="quiet" onPress={() => router.push("/join")}>Join a league</Button>
      </Card>

      <Card style={{ gap: space(1.5) }}>
        <H2>Background</H2>
        <Text style={[type.small, { color: color.inkMuted }]}>
          What sits behind the glass. Yours alone — everyone picks their own.
        </Text>
        <View style={{ flexDirection: "row", gap: space(1.25) }}>
          {CANVASES.map((c) => {
            const active = c.id === canvas.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => setCanvasChoice(c.id)}
                style={{
                  flex: 1,
                  borderRadius: 16,
                  overflow: "hidden",
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? color.accent : color.glassBorder,
                }}
              >
                <View style={{ height: 64, backgroundColor: c.base }}>
                  {/* A cheap echo of the glows — a swatch, not a render. */}
                  <View
                    style={{
                      position: "absolute",
                      top: -18,
                      left: 8,
                      width: 70,
                      height: 46,
                      borderRadius: 999,
                      backgroundColor: c.glows[0].color,
                      opacity: c.glows[0].opacity * 2,
                    }}
                  />
                </View>
                <View style={{ paddingVertical: 7, alignItems: "center", backgroundColor: color.surface }}>
                  <Text style={[type.small, { fontSize: 12.5, color: active ? color.ink : color.inkMuted }]}>
                    {c.name}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card style={{ gap: space(1.5) }}>
        <H2>Account</H2>
        <ErrorNote message={error} />
        <Button variant="quiet" onPress={signOut}>Sign out</Button>
        <Button variant="accent" onPress={confirmDelete}>Delete account</Button>
        <Text style={[type.small, { color: color.inkMuted }]}>
          Deleting removes your profile, memberships and personal stat lines.
          Games and team results stay on the record, de-attributed.
        </Text>
      </Card>

      <View style={{ alignItems: "center", paddingVertical: space(2) }}>
        <Lockup size={28} tone="white-red" />
      </View>
    </ScrollView>
  );
}
