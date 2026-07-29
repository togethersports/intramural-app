import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Card, EmptyState, Label } from "@/components/ui";
import { GameCard } from "@/components/GameCard";
import { useAuth } from "@/lib/auth";
import { getGames, getMyTeams } from "@/lib/data";
import { color, space } from "@/theme";
import type { GameRow } from "@core/types";

export default function Schedule() {
  const { user } = useAuth();
  const [games, setGames] = useState<GameRow[]>([]);
  const [seasonWeeks, setSeasonWeeks] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const teams = await getMyTeams(user.id);
    if (teams.length === 0) { setGames([]); setLoaded(true); return; }
    // Player-first: the schedule that matters is the one for the season
    // they're actually playing in.
    const all = await getGames(teams[0].season_id);
    setGames(all);
    setSeasonWeeks(Math.max(0, ...all.filter((g) => !g.is_playoff).map((g) => g.week)));
    setLoaded(true);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const byWeek = new Map<number, GameRow[]>();
  for (const g of games) {
    if (!byWeek.has(g.week)) byWeek.set(g.week, []);
    byWeek.get(g.week)!.push(g);
  }
  const weeks = [...byWeek.keys()].sort((a, b) => a - b);

  return (
    <ScrollView
      contentContainerStyle={{ padding: space(2), gap: space(2) }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.white} />}
    >
      {weeks.length === 0 ? (
        <Card>
          <EmptyState
            title={loaded ? "No games scheduled" : "Loading…"}
            body={loaded ? "Games appear once your commissioner builds the schedule." : undefined}
          />
        </Card>
      ) : (
        weeks.map((w) => (
          <Card key={w} style={{ gap: space(1.5) }}>
            <View>
              <Label>
                {byWeek.get(w)!.some((g) => g.is_playoff)
                  ? `Playoffs · round ${w - seasonWeeks}`
                  : `Week ${w}`}
              </Label>
            </View>
            {byWeek.get(w)!.map((g) => <GameCard key={g.id} game={g} />)}
          </Card>
        ))
      )}
    </ScrollView>
  );
}
