import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Card, EmptyState, H2, HScroll, Label, Num, TeamBadge } from "@/components/ui";
import { getGame, getGameEvents, getLineups, getTeamsWithRosters } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { computeBoxScore, type StatLine } from "@core/stats";
import { EVENT_LABELS } from "@core/game-constants";
import { color, space, type } from "@/theme";
import type { GameRow, PlayerGameStatRow } from "@core/types";

const COLS = ["PTS","REB","AST","STL","BLK","TO","PF","+/−"] as const;

export default function GameDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [game, setGame] = useState<GameRow | null>(null);
  const [lines, setLines] = useState<(StatLine & { userId: string; teamId: string })[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [events, setEvents] = useState<{ id: string; period: number; type: string; user_id: string | null; team_id: string | null; related_user_id: string | null; voided: boolean; seq: number }[]>([]);
  const [score, setScore] = useState({ home: 0, away: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const g = await getGame(id);
    if (!g) return;
    setGame(g);
    const [evs, lus, teams] = await Promise.all([
      getGameEvents(id), getLineups(id), getTeamsWithRosters(g.season_id),
    ]);
    setEvents(evs as never);
    const nameMap = new Map<string, string>();
    for (const t of teams) for (const r of t.roster) nameMap.set(r.user_id, r.full_name);
    setNames(nameMap);

    if (g.status === "final" || g.status === "forfeit") {
      // Final games read the materialized stat lines.
      const { data } = await supabase.from("player_game_stats").select("*").eq("game_id", id);
      setLines(((data as unknown as PlayerGameStatRow[]) ?? []).map((r) => ({
        ...r, userId: r.user_id, teamId: r.team_id,
      })));
      setScore({ home: g.home_score, away: g.away_score });
    } else {
      // Live/scheduled: compute from the event stream with the SAME pure
      // function the web app and the tracker use.
      const box = computeBoxScore(evs as never, lus as never, g.home_team_id, g.away_team_id);
      setLines([...box.players.entries()].map(([userId, l]) => ({ ...l, userId, teamId: l.team_id })));
      setScore(g.status === "live" ? { home: box.homeScore, away: box.awayScore } : { home: g.home_score, away: g.away_score });
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Live updates: subscribe to this game's events, plus a poll fallback for
  // when the socket drops on gym wifi.
  useEffect(() => {
    if (!id || game?.status !== "live") return;
    const ch = supabase
      .channel(`game:${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_events", filter: `game_id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${id}` }, () => load())
      .subscribe();
    const poll = setInterval(load, 10000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [id, game?.status, load]);

  if (!game) {
    return <ScrollView contentContainerStyle={{ padding: space(2) }}><Card><EmptyState title="Loading…" /></Card></ScrollView>;
  }

  const rowsFor = (teamId: string) =>
    lines.filter((l) => l.teamId === teamId).sort((a, b) => b.pts - a.pts);

  const Box = ({ teamId, name, abbrev, teamColor }: { teamId: string; name: string; abbrev: string; teamColor: string }) => (
    <Card style={{ gap: space(1.5) }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space(1.25) }}>
        <TeamBadge abbrev={abbrev} teamColor={teamColor} size={28} />
        <H2>{name}</H2>
      </View>
      {rowsFor(teamId).length === 0 ? (
        <Text style={[type.body, { color: color.inkFaint }]}>No stats recorded.</Text>
      ) : (
        <HScroll>
          <View>
            <View style={{ flexDirection: "row", paddingBottom: space(0.75) }}>
              <Label style={{ width: 130 }}>Player</Label>
              {COLS.map((c) => <Label key={c} style={{ width: 46, textAlign: "right" }}>{c}</Label>)}
            </View>
            {rowsFor(teamId).map((r) => (
              <View key={r.userId} style={{ flexDirection: "row", paddingVertical: space(0.75), borderTopWidth: 1, borderTopColor: color.rule }}>
                <Text numberOfLines={1} style={[type.bodyMedium, { width: 130, color: color.ink }]}>
                  {names.get(r.userId) ?? "Unnamed"}
                </Text>
                {([r.pts, r.reb, r.ast, r.stl, r.blk, r.tov, r.pf,
                   r.plus_minus > 0 ? `+${r.plus_minus}` : r.plus_minus] as const).map((v, i) => (
                  <Num key={i} size={15} style={{ width: 46, textAlign: "right" }}>{v}</Num>
                ))}
              </View>
            ))}
          </View>
        </HScroll>
      )}
    </Card>
  );

  return (
    <ScrollView
      contentContainerStyle={{ padding: space(2), gap: space(2) }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={color.white} />}
    >
      <Card style={{ gap: space(1.5) }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Label>Week {game.week}{game.time_slot?.label ? ` · ${game.time_slot.label}` : ""}</Label>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            {game.status === "live" ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color.accent }} /> : null}
            <Label style={{ color: game.status === "live" ? color.accent : color.ink }}>
              {game.status === "live" ? `Live · P${game.period}` : game.status}
            </Label>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space(2) }}>
          <View style={{ flex: 1, alignItems: "center", gap: 6 }}>
            <TeamBadge abbrev={game.home_team?.abbrev ?? "?"} teamColor={game.home_team?.color ?? color.bench} size={40} />
            <Text numberOfLines={1} style={[type.small, { color: color.inkBody }]}>{game.home_team?.name}</Text>
            <Num size={40}>{score.home}</Num>
          </View>
          <Text style={[type.h2, { color: color.inkFaint }]}>—</Text>
          <View style={{ flex: 1, alignItems: "center", gap: 6 }}>
            <TeamBadge abbrev={game.away_team?.abbrev ?? "?"} teamColor={game.away_team?.color ?? color.bench} size={40} />
            <Text numberOfLines={1} style={[type.small, { color: color.inkBody }]}>{game.away_team?.name}</Text>
            <Num size={40}>{score.away}</Num>
          </View>
        </View>
      </Card>

      <Box teamId={game.home_team_id} name={game.home_team?.name ?? "Home"} abbrev={game.home_team?.abbrev ?? "?"} teamColor={game.home_team?.color ?? color.bench} />
      <Box teamId={game.away_team_id} name={game.away_team?.name ?? "Away"} abbrev={game.away_team?.abbrev ?? "?"} teamColor={game.away_team?.color ?? color.bench} />

      <Card style={{ gap: space(1) }}>
        <H2>Play-by-play</H2>
        {events.filter((e) => !e.voided).length === 0 ? (
          <Text style={[type.body, { color: color.inkFaint }]}>Nothing yet.</Text>
        ) : (
          [...events].filter((e) => !e.voided).reverse().slice(0, 40).map((e) => (
            <View key={e.id} style={{ flexDirection: "row", gap: space(1.25), alignItems: "baseline" }}>
              <Label style={{ width: 28 }}>P{e.period}</Label>
              <Text style={[type.small, { flex: 1, color: color.inkBody }]}>
                <Text style={{ fontFamily: type.bodyMedium.fontFamily, color: color.ink }}>
                  {e.user_id ? (names.get(e.user_id) ?? "") : ""}
                </Text>
                {" "}{EVENT_LABELS[e.type] ?? e.type}
              </Text>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}
