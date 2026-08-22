/**
 * Every roster in the season — the question a league asks most often, and
 * the one the phone could not answer until now. Tap anyone to open their
 * season.
 *
 * Jersey numbers follow the league setting: a league that never handed out
 * shirts shows names alone rather than a column of blanks.
 */
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Avatar, Card, EmptyState, Label, TeamBadge } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { loadLeagueContext } from "@/lib/active-league";
import { getTeamsWithRosters } from "@/lib/data";
import { color, space, type } from "@/theme";
import type { TeamWithRoster } from "@core/types";

export default function Teams() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<TeamWithRoster[]>([]);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [jerseys, setJerseys] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const ctx = await loadLeagueContext(user.id);
    if (!ctx || !ctx.seasonId) { setLoaded(true); return; }
    setMyTeamId(ctx.team?.team_id ?? null);
    setTeams(await getTeamsWithRosters(ctx.seasonId));
    setJerseys(ctx.league.settings?.jersey_numbers !== false);
    setLoaded(true);
  }, [user]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <ScrollView contentContainerStyle={{ padding: space(2), gap: space(2), paddingBottom: space(5) }}>
      {teams.length === 0 ? (
        <Card>
          <EmptyState
            title={loaded ? "No teams yet" : "Loading…"}
            body={loaded ? "Teams appear once your commissioner creates them." : undefined}
          />
        </Card>
      ) : (
        teams.map((t) => (
          <Card key={t.id} style={{ gap: space(1.25) }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space(1.5) }}>
              <TeamBadge abbrev={t.abbrev} teamColor={t.color} size={30} />
              <Text style={[type.h2, { flex: 1, color: color.ink }]} numberOfLines={1}>
                {t.name}
              </Text>
              {t.id === myTeamId ? <Label style={{ color: color.blush }}>Mine</Label> : null}
            </View>
            {t.roster.length === 0 ? (
              <Text style={[type.small, { color: color.inkFaint }]}>Nobody drafted yet.</Text>
            ) : (
              t.roster.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() =>
                    r.is_guest
                      ? undefined
                      : router.push(`/league/player/${r.user_id}` as never)
                  }
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space(1.25),
                    paddingVertical: space(0.75),
                  }}
                >
                  <Avatar name={r.full_name} size={30} uri={r.avatar_url ?? undefined} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[type.bodyMedium, { color: color.ink }]} numberOfLines={1}>
                      {r.full_name}
                    </Text>
                    {r.position || r.is_captain ? (
                      <Text style={[type.small, { color: color.inkFaint }]}>
                        {[r.is_captain ? "Captain" : null, r.position]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    ) : null}
                  </View>
                  {jerseys && r.jersey_number != null ? (
                    <Text style={[type.small, { color: color.inkBody }]}>
                      #{r.jersey_number}
                    </Text>
                  ) : null}
                </Pressable>
              ))
            )}
          </Card>
        ))
      )}
    </ScrollView>
  );
}
