/**
 * The bracket, read-only — who plays who, and who is through.
 *
 * The shape comes from @core/bracket, the same resolver the web uses, so
 * the phone and the site can never disagree about who advanced.
 */
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Card, EmptyState, Label, Num } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { getActiveLeague, resolveTeam } from "@/lib/active-league";
import { getBracketNodes, getGames, getMyTeams, getTeams } from "@/lib/data";
import { roundName } from "@core/bracket";
import type { GameRow, TeamRow } from "@core/types";
import { color, space, type } from "@/theme";

export default function Playoffs() {
  const { user } = useAuth();
  const [nodes, setNodes] = useState<Awaited<ReturnType<typeof getBracketNodes>>>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [games, setGames] = useState<GameRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const mine = resolveTeam(await getMyTeams(user.id), getActiveLeague());
    if (!mine) { setLoaded(true); return; }
    const [n, t, g] = await Promise.all([
      getBracketNodes(mine.season_id),
      getTeams(mine.season_id),
      getGames(mine.season_id),
    ]);
    setNodes(n);
    setTeams(t);
    setGames(g);
    setLoaded(true);
  }, [user]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const nameOf = (id: string | null) =>
    id ? (teams.find((t) => t.id === id)?.name ?? "TBD") : "TBD";
  const rounds = [...new Set(nodes.map((n) => n.round))].sort((a, b) => a - b);
  const total = rounds.length;
  // The database rows already carry the real matchup once a game exists, and
  // the winner once one is decided — so the sides come from the game rather
  // than from re-resolving seeds the phone would have to recompute.
  const sideLabel = (source: string) =>
    source === "bye"
      ? "Bye"
      : source.startsWith("seed:")
        ? `Seed ${source.slice(5)}`
        : "Winner TBD";

  return (
    <ScrollView contentContainerStyle={{ padding: space(2), gap: space(2), paddingBottom: space(5) }}>
      {nodes.length === 0 ? (
        <Card>
          <EmptyState
            title={loaded ? "No bracket yet" : "Loading…"}
            body={loaded ? "The bracket appears once your commissioner seeds the playoffs." : undefined}
          />
        </Card>
      ) : (
        rounds.map((round) => (
          <Card key={round} style={{ gap: space(1.25) }}>
            <Label>{roundName(round, total)}</Label>
            {nodes
              .filter((n) => n.round === round)
              .map((n) => {
                const game = games.find((g) => g.id === n.game_id) ?? null;
                const done = game?.status === "final" || game?.status === "forfeit";
                const row = (
                  <View style={{ gap: 4 }}>
                    {[
                      {
                        name: game ? nameOf(game.home_team_id) : sideLabel(n.home_source),
                        score: game?.home_score,
                        id: game?.home_team_id ?? null,
                      },
                      {
                        name: game ? nameOf(game.away_team_id) : sideLabel(n.away_source),
                        score: game?.away_score,
                        id: game?.away_team_id ?? null,
                      },
                    ].map((side, i) => (
                      <View
                        key={i}
                        style={{ flexDirection: "row", alignItems: "center", gap: space(1) }}
                      >
                        <Text
                          numberOfLines={1}
                          style={[
                            n.winner_team_id != null && n.winner_team_id === side.id
                              ? type.bodyMedium
                              : type.body,
                            {
                              flex: 1,
                              color:
                                n.winner_team_id != null && n.winner_team_id === side.id
                                  ? color.ink
                                  : color.inkBody,
                            },
                          ]}
                        >
                          {side.name}
                        </Text>
                        {done ? <Num size={16}>{side.score ?? 0}</Num> : null}
                      </View>
                    ))}
                  </View>
                );
                return (
                  <View
                    key={n.id}
                    style={{
                      borderRadius: 14,
                      backgroundColor: color.paper,
                      padding: space(1.5),
                    }}
                  >
                    {n.game_id ? (
                      <Pressable onPress={() => router.push(`/game/${n.game_id}` as never)}>
                        {row}
                      </Pressable>
                    ) : (
                      row
                    )}
                  </View>
                );
              })}
          </Card>
        ))
      )}
    </ScrollView>
  );
}
