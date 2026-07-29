import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Button, Card, EmptyState, H2, Label, Num } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { getGames, getMyTeams, getSeasonPlayerStats, getTeams } from "@/lib/data";
import { computeStandings } from "@core/standings";
import { aggregateLines, perGame } from "@core/stats";
import { color, space, type } from "@/theme";

/** Column widths shared by the standings header and its rows. */
const COL = { wl: 30, diff: 50 } as const;

export default function Standings() {
  const { user } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<
    { teamId: string; name: string; teamColor: string; w: number; l: number; pct: number; diff: number }[]
  >([]);
  const [leaders, setLeaders] = useState<{ id: string; name: string; ppg: number }[]>([]);
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const teams = await getMyTeams(user.id);
    if (teams.length === 0) { setRows([]); setLoaded(true); return; }
    const seasonId = teams[0].season_id;
    setLeagueId(teams[0].league_id);
    const [seasonTeams, games, stats] = await Promise.all([
      getTeams(seasonId), getGames(seasonId), getSeasonPlayerStats(seasonId),
    ]);
    const { standings } = computeStandings(
      seasonTeams.map((t) => t.id),
      games.filter((g) => !g.is_playoff),
    );
    const byId = new Map(seasonTeams.map((t) => [t.id, t]));
    setRows(standings.map((s) => ({
      teamId: s.teamId,
      name: byId.get(s.teamId)?.name ?? "?",
      teamColor: byId.get(s.teamId)?.color ?? color.bench,
      w: s.w, l: s.l, pct: s.pct, diff: s.diff,
    })));

    const byPlayer = new Map<string, { name: string; lines: typeof stats }>();
    for (const r of stats) {
      if (!byPlayer.has(r.user_id)) byPlayer.set(r.user_id, { name: r.full_name ?? "Unnamed", lines: [] });
      byPlayer.get(r.user_id)!.lines.push(r);
    }
    setLeaders(
      [...byPlayer.entries()]
        .map(([id, v]) => {
          const t = aggregateLines(v.lines);
          return { id, name: v.name, ppg: perGame(t.pts, t.games) };
        })
        .sort((a, b) => b.ppg - a.ppg)
        .slice(0, 5),
    );
    setLoaded(true);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <ScrollView
      contentContainerStyle={{ padding: space(2), gap: space(2) }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.white} />}
    >
      <Card style={{ gap: space(1.5) }}>
        <H2>Standings</H2>
        {rows.length === 0 ? (
          <EmptyState title={loaded ? "No standings yet" : "Loading…"}
            body={loaded ? "Standings fill in once games go final." : undefined} />
        ) : (
          <View style={{ gap: space(0.5) }}>
            {/* Header and rows share COL widths and padding, or the
                right-aligned numerals drift out from under their labels. */}
            <View style={{ flexDirection: "row", gap: space(1), paddingHorizontal: space(1.25) }}>
              <Label style={{ flex: 1 }}>Team</Label>
              <Label style={{ width: COL.wl, textAlign: "right" }}>W</Label>
              <Label style={{ width: COL.wl, textAlign: "right" }}>L</Label>
              <Label style={{ width: COL.diff, textAlign: "right" }}>Diff</Label>
            </View>
            {rows.map((r, i) => (
              <View key={r.teamId} style={{
                flexDirection: "row", alignItems: "center", gap: space(1),
                backgroundColor: color.paper, borderRadius: 12,
                paddingHorizontal: space(1.25), paddingVertical: space(1.25),
              }}>
                <Num size={13} style={{ color: color.inkFaint, width: 16 }}>{i + 1}</Num>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: r.teamColor }} />
                <Text numberOfLines={1} style={[type.bodyMedium, { flex: 1, color: color.ink }]}>{r.name}</Text>
                <Num size={15} style={{ width: COL.wl, textAlign: "right" }}>{r.w}</Num>
                <Num size={15} style={{ width: COL.wl, textAlign: "right" }}>{r.l}</Num>
                <Num size={15} style={{ width: COL.diff, textAlign: "right", color: r.diff < 0 ? color.accent : color.ink }}>
                  {r.diff > 0 ? `+${r.diff}` : r.diff}
                </Num>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card style={{ gap: space(1.5) }}>
        <H2>Scoring leaders</H2>
        {leaders.length === 0 ? (
          <Text style={[type.body, { color: color.inkFaint }]}>Leaders appear after the first final.</Text>
        ) : (
          leaders.map((l, i) => (
            <View key={l.id} style={{ flexDirection: "row", alignItems: "center", gap: space(1.5) }}>
              <Num size={13} style={{ color: color.inkFaint, width: 16 }}>{i + 1}</Num>
              <Text numberOfLines={1} style={[type.bodyMedium, { flex: 1, color: color.ink }]}>{l.name}</Text>
              <Num size={19}>{l.ppg.toFixed(1)}</Num>
              <Label>PPG</Label>
            </View>
          ))
        )}
      </Card>

      {leagueId ? (
        <View style={{ gap: space(1) }}>
          <Button variant="quiet" onPress={() => router.push("/league/rules")}>League rules</Button>
          <Button variant="quiet" onPress={() => router.push("/league/availability")}>My availability</Button>
        </View>
      ) : null}
    </ScrollView>
  );
}
