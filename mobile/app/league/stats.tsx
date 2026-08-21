/**
 * Every player, every stat, sortable both ways — the full check, not a top
 * five. Tap a column to sort by it; tap it again to flip. Numbers are
 * per-game averages, which is the only fair way to compare a seven-game
 * starter with someone who played twice.
 */
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Card, EmptyState, HScroll, Label, Num } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { getMyTeams, getSeasonPlayerStats, getTeams } from "@/lib/data";
import { aggregateLines, perGame } from "@core/stats";
import { color, space, type } from "@/theme";
import type { PlayerGameStatRow } from "@core/types";

interface StatRow {
  userId: string;
  name: string;
  teamAbbrev: string;
  gp: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
}

const COLUMNS = [
  { key: "gp", label: "GP" },
  { key: "pts", label: "PTS" },
  { key: "reb", label: "REB" },
  { key: "ast", label: "AST" },
  { key: "stl", label: "STL" },
  { key: "blk", label: "BLK" },
  { key: "tov", label: "TO" },
] as const;

type SortKey = (typeof COLUMNS)[number]["key"] | "name";

const COL_WIDTH = 52;

export default function FullStats() {
  const { user } = useAuth();
  const [rows, setRows] = useState<StatRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("pts");
  const [descending, setDescending] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const teams = await getMyTeams(user.id);
    if (teams.length === 0) { setLoaded(true); return; }
    const [seasonTeams, stats] = await Promise.all([
      getTeams(teams[0].season_id),
      getSeasonPlayerStats(teams[0].season_id),
    ]);
    const abbrev = new Map(seasonTeams.map((t) => [t.id, t.abbrev]));
    const byPlayer = new Map<string, { name: string; teamId: string; lines: PlayerGameStatRow[] }>();
    for (const r of stats) {
      if (!r.user_id) continue; // guests belong to a game, not a season table
      if (!byPlayer.has(r.user_id)) {
        byPlayer.set(r.user_id, { name: r.full_name ?? "Unnamed", teamId: r.team_id, lines: [] });
      }
      byPlayer.get(r.user_id)!.lines.push(r);
    }
    setRows(
      [...byPlayer.entries()].map(([userId, p]) => {
        const t = aggregateLines(p.lines);
        return {
          userId,
          name: p.name,
          teamAbbrev: abbrev.get(p.teamId) ?? "",
          gp: t.games,
          pts: perGame(t.pts, t.games),
          reb: perGame(t.reb, t.games),
          ast: perGame(t.ast, t.games),
          stl: perGame(t.stl, t.games),
          blk: perGame(t.blk, t.games),
          tov: perGame(t.tov, t.games),
        };
      }),
    );
    setLoaded(true);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const cmp =
        sortKey === "name"
          ? a.name.localeCompare(b.name)
          : a[sortKey] - b[sortKey] || a.name.localeCompare(b.name);
      return descending ? -cmp : cmp;
    });
    return copy;
  }, [rows, sortKey, descending]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setDescending((d) => !d);
    else {
      setSortKey(key);
      // A fresh numeric column starts best-first; names start A-first.
      setDescending(key !== "name");
    }
  };

  const arrow = descending ? "▾" : "▴";

  return (
    <ScrollView contentContainerStyle={{ padding: space(2), gap: space(2), paddingBottom: space(4) }}>
      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title={loaded ? "No stats yet" : "Loading…"}
            body={loaded ? "The table fills in after the first final." : undefined}
          />
        </Card>
      ) : (
        <Card style={{ paddingHorizontal: 0, paddingVertical: space(1) }}>
          <HScroll>
            <View>
              {/* Header row — every cell is a sort control. */}
              <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: space(2), paddingVertical: space(1) }}>
                <Pressable onPress={() => toggleSort("name")} style={{ width: 148 }} hitSlop={6}>
                  <Label style={sortKey === "name" ? { color: color.blush } : undefined}>
                    Player{sortKey === "name" ? ` ${arrow}` : ""}
                  </Label>
                </Pressable>
                {COLUMNS.map((c) => (
                  <Pressable key={c.key} onPress={() => toggleSort(c.key)} style={{ width: COL_WIDTH }} hitSlop={6}>
                    <Label
                      style={[
                        { textAlign: "right" },
                        sortKey === c.key ? { color: color.blush } : undefined,
                      ]}
                    >
                      {c.label}
                      {sortKey === c.key ? ` ${arrow}` : ""}
                    </Label>
                  </Pressable>
                ))}
              </View>
              {sorted.map((r, i) => (
                <View
                  key={r.userId}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: space(2),
                    paddingVertical: space(1.1),
                    backgroundColor: i % 2 === 1 ? "rgba(255,255,255,0.03)" : "transparent",
                  }}
                >
                  <View style={{ width: 148, paddingRight: 8 }}>
                    <Text numberOfLines={1} style={[type.bodyMedium, { fontSize: 15, color: color.ink }]}>
                      {r.name}
                    </Text>
                    <Text style={[type.small, { fontSize: 11.5, color: color.inkFaint }]}>{r.teamAbbrev}</Text>
                  </View>
                  <Num size={14} style={{ width: COL_WIDTH, textAlign: "right", color: color.inkBody }}>
                    {r.gp}
                  </Num>
                  {(["pts", "reb", "ast", "stl", "blk", "tov"] as const).map((k) => (
                    <Num
                      key={k}
                      size={14}
                      style={{
                        width: COL_WIDTH,
                        textAlign: "right",
                        color: sortKey === k ? color.ink : color.inkBody,
                      }}
                    >
                      {r[k].toFixed(1)}
                    </Num>
                  ))}
                </View>
              ))}
            </View>
          </HScroll>
          <Text style={[type.small, { fontSize: 12, color: color.inkFaint, paddingHorizontal: space(2), paddingTop: space(1) }]}>
            Per-game averages. Tap a column to sort; tap again to flip.
          </Text>
        </Card>
      )}
    </ScrollView>
  );
}
