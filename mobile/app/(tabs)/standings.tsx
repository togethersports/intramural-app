import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Avatar, Button, Card, EmptyState, H2, Label, Num } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { getGames, getMyTeams, getSeasonPlayerStats, getTeams } from "@/lib/data";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useMyIdentity } from "@/lib/profile";
import { TAB_CLEARANCE, useBarScroll } from "@/lib/scroll";
import { computeStandings } from "@core/standings";
import { STAT_CATEGORIES, leadersIn, type StatSource } from "@core/awards";

import { color, space, type } from "@/theme";

/** Column widths shared by the standings header and its rows. */
const COL = { wl: 30, diff: 50 } as const;

export default function Standings() {
  const { user } = useAuth();
  const router = useRouter();
  const onScroll = useBarScroll();
  const insets = useSafeAreaInsets();
  const me = useMyIdentity(user?.id);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState<string | null>(null);
  const [rows, setRows] = useState<
    { teamId: string; name: string; teamColor: string; w: number; l: number; pct: number; diff: number }[]
  >([]);
  const [boards, setBoards] = useState<
    { key: string; label: string; unit: string; rows: { userId: string; name: string; value: number }[] }[]
  >([]);
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const teams = await getMyTeams(user.id);
    if (teams.length === 0) { setRows([]); setLoaded(true); return; }
    const seasonId = teams[0].season_id;
    setLeagueId(teams[0].league_id);
    setMyTeamId(teams[0].team_id);
    setLeagueName(teams[0].league_name);
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
      teamColor: byId.get(s.teamId)?.color ?? color.teamFallback,
      w: s.w, l: s.l, pct: s.pct, diff: s.diff,
    })));

    // One source per player, then the same leadersIn the award board uses —
    // top three in every category, not just scoring.
    const teamName = new Map(seasonTeams.map((t) => [t.id, t.name]));
    const byPlayer = new Map<string, StatSource>();
    for (const r of stats) {
      if (!r.user_id) continue; // guests: box score yes, season boards no
      if (!byPlayer.has(r.user_id)) {
        byPlayer.set(r.user_id, {
          userId: r.user_id,
          name: r.full_name ?? "Unnamed",
          teamId: r.team_id,
          teamName: teamName.get(r.team_id) ?? "",
          lines: [],
        });
      }
      byPlayer.get(r.user_id)!.lines.push(r);
    }
    const sources = [...byPlayer.values()];
    setBoards(
      STAT_CATEGORIES.map((c) => ({
        key: c.key,
        label: c.label,
        unit: c.unit,
        rows: leadersIn(sources, c, { limit: 3 }).map((l) => ({
          userId: l.userId,
          name: l.name,
          value: l.value,
        })),
      })).filter((b) => b.rows.length > 0),
    );
    setLoaded(true);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <ScrollView
      onScroll={onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{ padding: space(2), paddingTop: insets.top + space(1), gap: space(2), paddingBottom: TAB_CLEARANCE }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.ink} />}
    >
      <ScreenHeader
        title={leagueName ?? "League"}
        right={me ? <Avatar name={me.name || "?"} size={34} uri={me.avatarUrl} /> : undefined}
      />
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
                backgroundColor: r.teamId === myTeamId ? color.tint : color.paper,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: r.teamId === myTeamId ? "rgba(255,92,72,0.34)" : color.ruleSoft,
                paddingHorizontal: space(1.25), paddingVertical: space(1.25),
              }}>
                <Num size={13} style={{ color: color.inkFaint, width: 16 }}>{i + 1}</Num>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: r.teamColor }} />
                <Text numberOfLines={1} style={[type.bodyMedium, { flex: 1, color: color.ink }]}>{r.name}</Text>
                <Num size={15} style={{ width: COL.wl, textAlign: "right" }}>{r.w}</Num>
                <Num size={15} style={{ width: COL.wl, textAlign: "right" }}>{r.l}</Num>
                <Num size={15} style={{ width: COL.diff, textAlign: "right", color: r.diff < 0 ? color.danger : color.ink }}>
                  {r.diff > 0 ? `+${r.diff}` : r.diff}
                </Num>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card style={{ gap: space(1.5) }}>
        <H2>Leaders</H2>
        {boards.length === 0 ? (
          <Text style={[type.body, { color: color.inkFaint }]}>Leaders appear after the first final.</Text>
        ) : (
          boards.map((b) => (
            <View key={b.key} style={{ gap: space(0.75) }}>
              <Label>{b.label}</Label>
              {b.rows.map((r, i) => (
                <View key={r.userId} style={{ flexDirection: "row", alignItems: "center", gap: space(1.5) }}>
                  <Num size={13} style={{ color: color.inkFaint, width: 16 }}>{i + 1}</Num>
                  <Text numberOfLines={1} style={[type.bodyMedium, { flex: 1, color: color.ink }]}>{r.name}</Text>
                  <Num size={17}>{r.value.toFixed(1)}</Num>
                  <Label style={{ width: 34 }}>{b.unit}</Label>
                </View>
              ))}
            </View>
          ))
        )}
        <Button variant="quiet" onPress={() => router.push("/league/stats")}>
          Full stats — every player
        </Button>
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
