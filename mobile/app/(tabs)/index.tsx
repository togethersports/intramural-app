import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Button,
  Card,
  EmptyState,
  H2,
  Label,
  Num,
  TeamBadge,
} from "@/components/ui";
import { GameCard } from "@/components/GameCard";
import { useAuth } from "@/lib/auth";
import {
  getMyLeagues,
  getMyTeams,
  getUpcomingGames,
  type LeagueSummary,
  type MyTeam,
} from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { color, space, type } from "@/theme";
import type { GameRow, PlayerGameStatRow } from "@core/types";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [teams, setTeams] = useState<MyTeam[]>([]);
  const [games, setGames] = useState<GameRow[]>([]);
  const [lastLine, setLastLine] = useState<PlayerGameStatRow | null>(null);
  const [name, setName] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [ls, ts, profile, stat] = await Promise.all([
      getMyLeagues(),
      getMyTeams(user.id),
      supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      supabase
        .from("player_game_stats")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    setLeagues(ls);
    setTeams(ts);
    setName((profile.data?.full_name as string) ?? "");
    setLastLine((stat.data as PlayerGameStatRow) ?? null);
    setGames(await getUpcomingGames(ts.map((t) => t.team_id)));
    setLoaded(true);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const firstName = (name || "there").split(" ")[0];

  return (
    <ScrollView
      contentContainerStyle={{ padding: space(2), gap: space(2) }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.white} />
      }
    >
      <View>
        <Text style={[type.h1, { color: color.white }]}>
          {greeting()}, {firstName}
        </Text>
        <Text style={[type.bodyMedium, { color: color.white, marginTop: 2 }]}>
          Here&apos;s where your leagues stand.
        </Text>
      </View>

      {/* Next games */}
      <Card style={{ gap: space(1.5) }}>
        <H2>Next up</H2>
        {games.length === 0 ? (
          <EmptyState
            title={loaded ? "No games coming up" : "Loading…"}
            body={
              loaded
                ? teams.length > 0
                  ? "You're between games — check the schedule."
                  : "You'll see your games here once you're on a team."
                : undefined
            }
          />
        ) : (
          games.slice(0, 3).map((g) => <GameCard key={g.id} game={g} />)
        )}
      </Card>

      {/* Last stat line */}
      <Card style={{ gap: space(1.5) }}>
        <H2>My last stat line</H2>
        {lastLine ? (
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {(
              [
                [lastLine.pts, "PTS"],
                [lastLine.reb, "REB"],
                [lastLine.ast, "AST"],
                [lastLine.stl, "STL"],
                [
                  lastLine.plus_minus > 0
                    ? `+${lastLine.plus_minus}`
                    : lastLine.plus_minus,
                  "+/−",
                ],
              ] as const
            ).map(([v, l]) => (
              <View key={l} style={{ alignItems: "center" }}>
                <Num size={30}>{v}</Num>
                <Label>{l}</Label>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            title="No stats yet"
            body="Your line shows up after your first tracked game."
          />
        )}
      </Card>

      {/* My teams */}
      <Card style={{ gap: space(1.5) }}>
        <H2>My teams</H2>
        {teams.length === 0 ? (
          <EmptyState
            title="Not on a team yet"
            body="Join your school's league with the six-character code from your commissioner."
            action={
              <Button variant="accent" onPress={() => router.push("/join")}>
                I have a join code
              </Button>
            }
          />
        ) : (
          teams.map((t) => (
            <View key={t.team_id} style={{ flexDirection: "row", alignItems: "center", gap: space(1.5) }}>
              <TeamBadge abbrev={t.team_abbrev} teamColor={t.team_color} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={[type.bodyMedium, { color: color.ink }]} numberOfLines={1}>
                  {t.team_name}
                </Text>
                <Text style={[type.small, { color: color.inkMuted }]} numberOfLines={1}>
                  {t.league_name}
                </Text>
              </View>
            </View>
          ))
        )}
      </Card>

      {leagues.length > 0 ? (
        <Button variant="quiet" onPress={() => router.push("/join")}>
          Join another league
        </Button>
      ) : null}
    </ScrollView>
  );
}
