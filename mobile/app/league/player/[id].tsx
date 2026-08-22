/**
 * One player's season — the line you get asked for when somebody says
 * "how many is he averaging?" and nobody has a laptop.
 */
import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Avatar, Card, EmptyState, Label, Num } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { getActiveLeague, resolveTeam } from "@/lib/active-league";
import { getMyTeams, getSeasonPlayerStats, getTeams } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { aggregateLines, formatPct, pct, perGame, type SeasonTotals } from "@core/stats";
import type { PlayerGameStatRow } from "@core/types";
import { color, space, type } from "@/theme";

export default function Player() {
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [totals, setTotals] = useState<SeasonTotals | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!user || !id) return;
    const [{ data: profile }, mine] = await Promise.all([
      supabase.from("profiles").select("full_name, avatar_url").eq("id", id).maybeSingle(),
      getMyTeams(user.id).then((ts) => resolveTeam(ts, getActiveLeague())),
    ]);
    setName((profile?.full_name as string) ?? "Unnamed");
    setAvatar((profile?.avatar_url as string | null) ?? null);
    if (!mine) { setLoaded(true); return; }
    const [stats, teams] = await Promise.all([
      getSeasonPlayerStats(mine.season_id),
      getTeams(mine.season_id),
    ]);
    const lines = stats.filter((s) => s.user_id === id) as PlayerGameStatRow[];
    setTotals(lines.length > 0 ? aggregateLines(lines) : null);
    const teamId = lines[0]?.team_id;
    setTeamName(teams.find((t) => t.id === teamId)?.name ?? null);
    setLoaded(true);
  }, [user, id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const per = (n: number) => (totals ? perGame(n, totals.games).toFixed(1) : "0.0");

  return (
    <ScrollView contentContainerStyle={{ padding: space(2.5), gap: space(2) }}>
      <Card style={{ flexDirection: "row", alignItems: "center", gap: space(2) }}>
        <Avatar name={name || "?"} size={56} uri={avatar} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[type.h2, { color: color.ink }]} numberOfLines={1}>{name}</Text>
          {teamName ? (
            <Text style={[type.small, { color: color.inkMuted }]}>{teamName}</Text>
          ) : null}
        </View>
      </Card>

      {!totals ? (
        <Card>
          <EmptyState
            title={loaded ? "No stats yet" : "Loading…"}
            body={loaded ? "Their line appears after their first final." : undefined}
          />
        </Card>
      ) : (
        <>
          <Card style={{ gap: space(1.5) }}>
            <Label>Per game</Label>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(2) }}>
              {([
                ["PTS", per(totals.pts)],
                ["REB", per(totals.reb)],
                ["AST", per(totals.ast)],
                ["STL", per(totals.stl)],
                ["BLK", per(totals.blk)],
                ["TO", per(totals.tov)],
              ] as const).map(([k, v]) => (
                <View key={k} style={{ minWidth: 64 }}>
                  <Label>{k}</Label>
                  <Num size={22}>{v}</Num>
                </View>
              ))}
            </View>
          </Card>

          <Card style={{ gap: space(1.5) }}>
            <Label>Season totals</Label>
            {([
              ["Games", String(totals.games)],
              ["Points", String(totals.pts)],
              ["Rebounds", String(totals.reb)],
              ["Assists", String(totals.ast)],
              ["Field goals", `${totals.fgm}/${totals.fga} · ${formatPct(pct(totals.fgm, totals.fga))}`],
              ["Threes", `${totals.tpm}/${totals.tpa} · ${formatPct(pct(totals.tpm, totals.tpa))}`],
              ["Free throws", `${totals.ftm}/${totals.fta} · ${formatPct(pct(totals.ftm, totals.fta))}`],
            ] as const).map(([k, v]) => (
              <View key={k} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={[type.body, { color: color.inkBody }]}>{k}</Text>
                <Text style={[type.bodyMedium, { color: color.ink }]}>{v}</Text>
              </View>
            ))}
          </Card>
        </>
      )}
    </ScrollView>
  );
}
