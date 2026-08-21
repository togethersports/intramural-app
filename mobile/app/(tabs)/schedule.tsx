/**
 * Schedule — grouped by day, the way a student actually asks the question
 * ("what's on Wednesday?"), not by week number. Today gets the coral label
 * and your own games get the coral tint; the period tag on each row is
 * carried by GameCard, which drops the date because the day header has it.
 */
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Card, EmptyState, Label } from "@/components/ui";
import { GameCard, formatDate } from "@/components/GameCard";
import { useAuth } from "@/lib/auth";
import { getGames, getMyTeams } from "@/lib/data";
import { TAB_CLEARANCE, useBarScroll } from "@/lib/scroll";
import { color, space, type } from "@/theme";
import type { GameRow } from "@core/types";

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Schedule() {
  const { user } = useAuth();
  const onScroll = useBarScroll();
  const [games, setGames] = useState<GameRow[]>([]);
  const [myTeamIds, setMyTeamIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const teams = await getMyTeams(user.id);
    if (teams.length === 0) { setGames([]); setLoaded(true); return; }
    // Player-first: the schedule that matters is the one for the season
    // they're actually playing in.
    setMyTeamIds(new Set(teams.map((t) => t.team_id)));
    setGames(await getGames(teams[0].season_id));
    setLoaded(true);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  // Group by date; dateless fixtures gather at the end under "Date TBD".
  const byDay = new Map<string, GameRow[]>();
  for (const g of games) {
    const key = g.scheduled_date ?? "zzz-tbd";
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(g);
  }
  const days = [...byDay.keys()].sort();
  const today = isoToday();

  return (
    <ScrollView
      onScroll={onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{ padding: space(2), gap: space(2), paddingBottom: TAB_CLEARANCE }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.ink} />}
    >
      <Text style={[type.h1, { color: color.ink, paddingHorizontal: 2 }]}>Schedule</Text>
      {days.length === 0 ? (
        <Card>
          <EmptyState
            title={loaded ? "No games scheduled" : "Loading…"}
            body={loaded ? "Games appear once your commissioner builds the schedule." : undefined}
          />
        </Card>
      ) : (
        days.map((day) => {
          const isToday = day === today;
          const slate = byDay.get(day)!;
          return (
            <View key={day} style={{ gap: space(1) }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: space(1), paddingHorizontal: 4 }}>
                <Label style={isToday ? { color: color.blush } : undefined}>
                  {day === "zzz-tbd" ? "Date TBD" : isToday ? "Today" : formatDate(day)}
                </Label>
                {slate.some((g) => g.is_playoff) ? (
                  <Label style={{ color: color.inkFaint }}>Playoffs</Label>
                ) : null}
              </View>
              <View style={{ gap: space(1) }}>
                {slate.map((g) => (
                  <View
                    key={g.id}
                    style={
                      myTeamIds.has(g.home_team_id ?? "") || myTeamIds.has(g.away_team_id ?? "")
                        ? {
                            borderRadius: 15,
                            borderWidth: 1,
                            borderColor: "rgba(255,92,72,0.34)",
                            backgroundColor: color.tint,
                          }
                        : undefined
                    }
                  >
                    <GameCard game={g} hideDate />
                  </View>
                ))}
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}
