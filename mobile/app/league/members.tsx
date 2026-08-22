/**
 * Everyone in the league and what they are — the roll, not the roster.
 * Read-only on the phone: changing someone's role is a decision worth a
 * bigger screen, and RLS would refuse it from here anyway unless you are
 * an admin.
 */
import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Avatar, Card, EmptyState, Label } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { getActiveLeague, resolveLeague } from "@/lib/active-league";
import { getLeagueMembers, getMyLeagues, type LeagueMemberRow } from "@/lib/data";
import { color, space, type } from "@/theme";

const ROLE_ORDER: Record<string, number> = {
  commissioner: 0, admin: 1, captain: 2, player: 3, spectator: 4,
};

export default function Members() {
  const { user } = useAuth();
  const [members, setMembers] = useState<LeagueMemberRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const league = resolveLeague(await getMyLeagues(), getActiveLeague());
    if (!league) { setLoaded(true); return; }
    const rows = await getLeagueMembers(league.id);
    rows.sort(
      (a, b) =>
        (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) ||
        a.full_name.localeCompare(b.full_name),
    );
    setMembers(rows);
    setLoaded(true);
  }, [user]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <ScrollView contentContainerStyle={{ padding: space(2), gap: space(1), paddingBottom: space(5) }}>
      <Card style={{ gap: space(1) }}>
        {members.length === 0 ? (
          <EmptyState title={loaded ? "Nobody yet" : "Loading…"} />
        ) : (
          members.map((m) => (
            <View
              key={m.user_id}
              style={{ flexDirection: "row", alignItems: "center", gap: space(1.25), paddingVertical: space(0.75) }}
            >
              <Avatar name={m.full_name} size={32} uri={m.avatar_url ?? undefined} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[type.bodyMedium, { color: color.ink }]} numberOfLines={1}>
                  {m.full_name}
                </Text>
                {m.grade ? (
                  <Text style={[type.small, { color: color.inkFaint }]}>Grade {m.grade}</Text>
                ) : null}
              </View>
              <Label style={m.role === "commissioner" ? { color: color.blush } : undefined}>
                {m.role}
              </Label>
            </View>
          ))
        )}
      </Card>
      <Text style={[type.small, { color: color.inkFaint, textAlign: "center" }]}>
        {members.length} member{members.length === 1 ? "" : "s"}
      </Text>
    </ScrollView>
  );
}
