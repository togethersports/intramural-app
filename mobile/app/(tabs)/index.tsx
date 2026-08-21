/**
 * Home — one glance, one answer: where do I need to be next.
 *
 * Priority order straight from the design reference: the league you're in,
 * the game you play next (the hero), how you're doing (three tiles), what's
 * live right now, then your teams. Everything else has a tab.
 */
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { Button, Card, EmptyState, Label, Num, TeamBadge } from "@/components/ui";
import { RoleChip, ScreenHeader } from "@/components/ScreenHeader";
import { GameCard, formatDate } from "@/components/GameCard";
import { useAuth } from "@/lib/auth";
import {
  getGames,
  getMyLeagues,
  getMyTeams,
  getTeams,
  getUpcomingGames,
  type LeagueSummary,
  type MyTeam,
} from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { TAB_CLEARANCE, useBarScroll } from "@/lib/scroll";
import { computeStandings } from "@core/standings";
import { color, radius, space, type } from "@/theme";
import type { GameRow, PlayerGameStatRow } from "@core/types";

const ICON = {
  stroke: color.blush,
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  fill: "none",
};

function ordinal(n: number): string {
  const rem = n % 100;
  if (rem >= 11 && rem <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10 <= 3 ? n % 10 : 0]}`;
}

/** "in 2 days", "today", "in 3 hr" — the hero counts down, not up. */
function untilLabel(date: string | null): string {
  if (!date) return "date TBD";
  const then = new Date(`${date}T00:00:00`);
  const now = new Date();
  const days = Math.round(
    (then.setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86_400_000,
  );
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const onScroll = useBarScroll();
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [teams, setTeams] = useState<MyTeam[]>([]);
  const [games, setGames] = useState<GameRow[]>([]);
  const [standing, setStanding] = useState<{ rank: number; streak: string } | null>(null);
  const [ppg, setPpg] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [ls, ts, profile, statRes] = await Promise.all([
      getMyLeagues(),
      getMyTeams(user.id),
      supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      supabase
        .from("player_game_stats")
        .select("pts")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(25),
    ]);
    setLeagues(ls);
    setTeams(ts);
    setName((profile.data?.full_name as string) ?? "");

    const lines = (statRes.data ?? []) as Pick<PlayerGameStatRow, "pts">[];
    setPpg(
      lines.length > 0
        ? lines.reduce((sum, l) => sum + l.pts, 0) / lines.length
        : null,
    );

    if (ts.length > 0) {
      const [seasonTeams, seasonGames, upcoming] = await Promise.all([
        getTeams(ts[0].season_id),
        getGames(ts[0].season_id),
        getUpcomingGames(ts.map((t) => t.team_id)),
      ]);
      setGames(upcoming);
      const { standings } = computeStandings(
        seasonTeams.map((t) => t.id),
        seasonGames.filter((g) => !g.is_playoff),
      );
      const idx = standings.findIndex((s) => s.teamId === ts[0].team_id);
      setStanding(
        idx >= 0 ? { rank: idx + 1, streak: standings[idx].streak } : null,
      );
    } else {
      setGames([]);
      setStanding(null);
    }
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
  const league = leagues[0] ?? null;
  const myTeam = teams[0] ?? null;
  // The hero is the next game that involves me; live beats scheduled.
  const hero =
    games.find((g) => g.status === "live") ??
    games.find((g) => g.status === "scheduled") ??
    null;
  const heroOpponent =
    hero && myTeam
      ? hero.home_team_id === myTeam.team_id
        ? hero.away_team?.name
        : hero.home_team?.name
      : null;
  const liveElsewhere = games.filter(
    (g) => g.status === "live" && g.id !== hero?.id,
  );

  return (
    <ScrollView
      onScroll={onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{
        padding: space(2),
        gap: space(1.75),
        paddingBottom: TAB_CLEARANCE,
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.ink} />
      }
    >
      {/* Identity header — the mark, then who and where you are. */}
      <ScreenHeader
        title={myTeam ? myTeam.team_name : league ? league.name : `Hey, ${firstName}`}
        subtitle={myTeam ? myTeam.league_name : league ? "No team yet" : "Join a league to start"}
        right={league ? <RoleChip role={league.role} /> : undefined}
      />

      {/* The hero: you play next. */}
      {hero && myTeam ? (
        <View style={s.hero}>
          <LinearGradient
            colors={["rgba(255,92,72,0.42)", "rgba(255,92,72,0.06)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={{ borderRadius: 29, padding: space(2.25) }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Label style={{ color: color.blush }}>
                {hero.status === "live" ? "Live now" : "You play next"}
              </Label>
              <View style={s.heroWhen}>
                <Label style={{ color: color.ink, fontSize: 10 }}>
                  {hero.status === "live"
                    ? `${hero.home_score} – ${hero.away_score}`
                    : untilLabel(hero.scheduled_date)}
                </Label>
              </View>
            </View>
            <Text
              style={[type.h1, { fontSize: 28, color: color.ink, marginTop: space(1.25) }]}
              numberOfLines={2}
            >
              {myTeam.team_name} vs {heroOpponent ?? "TBD"}
            </Text>
            <View style={{ marginTop: space(1.5), flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
              <View style={s.heroChip}>
                <Svg width={14} height={14} viewBox="0 0 24 24">
                  <Rect x={4} y={5} width={16} height={15} rx={3} {...ICON} />
                  <Path d="M8 3v4M16 3v4M4 10h16" {...ICON} />
                </Svg>
                <Text style={s.heroChipText}>{formatDate(hero.scheduled_date)}</Text>
              </View>
              {hero.time_slot?.label ? (
                <View style={s.heroChip}>
                  <Svg width={14} height={14} viewBox="0 0 24 24">
                    <Circle cx={12} cy={12} r={8} {...ICON} />
                    <Path d="M12 8v4l3 2" {...ICON} />
                  </Svg>
                  <Text style={s.heroChipText}>{hero.time_slot.label}</Text>
                </View>
              ) : null}
              {hero.venue?.name ? (
                <View style={s.heroChip}>
                  <Svg width={14} height={14} viewBox="0 0 24 24">
                    <Path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z" {...ICON} />
                    <Circle cx={12} cy={10} r={2.4} {...ICON} />
                  </Svg>
                  <Text style={s.heroChipText}>{hero.venue.name}</Text>
                </View>
              ) : null}
            </View>
            <Button
              variant="primary"
              style={{ marginTop: space(2), borderRadius: 15, minHeight: 48 }}
              onPress={() => router.push(`/game/${hero.id}`)}
            >
              {hero.status === "live" ? "Follow it live" : "Game details"}
            </Button>
          </LinearGradient>
        </View>
      ) : (
        <Card>
          <EmptyState
            title={loaded ? "No games coming up" : "Loading…"}
            body={
              loaded
                ? myTeam
                  ? "You're between games — the schedule has what's next."
                  : "Join your school's league with the six-character code from your commissioner."
                : undefined
            }
            action={
              loaded && !myTeam ? (
                <Button variant="accent" onPress={() => router.push("/join")}>
                  I have a join code
                </Button>
              ) : undefined
            }
          />
        </Card>
      )}

      {/* Three tiles: standing, streak, your scoring. */}
      {myTeam ? (
        <View style={{ flexDirection: "row", gap: space(1.25) }}>
          {(
            [
              [standing ? ordinal(standing.rank) : "—", "Standing"],
              [standing?.streak ?? "—", "Streak"],
              [ppg !== null ? ppg.toFixed(1) : "—", "Your PPG"],
            ] as const
          ).map(([v, l]) => (
            <View key={l} style={s.tile}>
              <Num size={22}>{v}</Num>
              <Text style={[type.small, { color: color.inkMuted, marginTop: 2 }]}>{l}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* A game happening right now that isn't yours. */}
      {liveElsewhere.map((g) => (
        <Pressable
          key={g.id}
          onPress={() => router.push(`/game/${g.id}`)}
          style={({ pressed }) => [s.liveRow, pressed && { opacity: 0.85 }]}
        >
          <View style={s.liveDot} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[type.bodyMedium, { color: color.ink }]} numberOfLines={1}>
              {g.home_team?.name ?? "TBD"} {g.home_score} – {g.away_score}{" "}
              {g.away_team?.name ?? "TBD"}
            </Text>
            <Text style={[type.small, { color: color.inkMuted }]} numberOfLines={1}>
              Live now{g.venue?.name ? ` · ${g.venue.name}` : ""}
            </Text>
          </View>
        </Pressable>
      ))}

      {/* The rest of the slate. */}
      {games.filter((g) => g.id !== hero?.id && g.status !== "live").length > 0 ? (
        <Card style={{ gap: space(1.25) }}>
          <Label>Coming up</Label>
          {games
            .filter((g) => g.id !== hero?.id && g.status !== "live")
            .slice(0, 3)
            .map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
        </Card>
      ) : null}

      {/* My teams */}
      {teams.length > 0 ? (
        <Card style={{ gap: space(1.5) }}>
          <Label>My teams</Label>
          {teams.map((t) => (
            <View
              key={t.team_id}
              style={{ flexDirection: "row", alignItems: "center", gap: space(1.5) }}
            >
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
          ))}
        </Card>
      ) : null}

      {leagues.length > 0 ? (
        <Button variant="quiet" onPress={() => router.push("/join")}>
          Join another league
        </Button>
      ) : null}
    </ScrollView>
  );
}


const s = StyleSheet.create({
  hero: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(255,130,110,0.3)",
    overflow: "hidden",
    shadowColor: color.accent,
    shadowOpacity: 0.35,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 13 },
    elevation: 10,
  },
  heroWhen: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  heroChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  heroChipText: { ...type.small, fontSize: 13, color: color.ink },
  tile: {
    flex: 1,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.glassBorder,
    borderRadius: radius.panel,
    padding: space(1.75),
  },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(1.5),
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.glassBorder,
    borderRadius: radius.panel,
    padding: space(2),
  },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: color.accent },
});
