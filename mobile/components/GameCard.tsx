import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { color, radius, space, type } from "@/theme";
import { Num, TeamBadge } from "./ui";
import type { GameRow } from "@core/types";

/** Dates come back as plain YYYY-MM-DD; parse as UTC so the day never slips. */
export function formatDate(d: string | null): string {
  if (!d) return "TBD";
  const dt = new Date(`${d}T00:00:00Z`);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${days[dt.getUTCDay()]} ${months[dt.getUTCMonth()]} ${dt.getUTCDate()}`;
}

function Side({
  name,
  abbrev,
  teamColor,
  score,
  showScore,
  won,
}: {
  name: string;
  abbrev: string;
  teamColor: string;
  score: number;
  showScore: boolean;
  won: boolean;
}) {
  return (
    <View style={s.side}>
      <TeamBadge abbrev={abbrev} teamColor={teamColor} size={28} />
      <Text
        numberOfLines={1}
        style={[
          type.body,
          { flex: 1, color: color.ink, fontFamily: won ? type.h2.fontFamily : type.bodyMedium.fontFamily },
        ]}
      >
        {name}
      </Text>
      {showScore ? (
        <Num size={19} style={{ color: won ? color.ink : color.inkMuted }}>
          {score}
        </Num>
      ) : null}
    </View>
  );
}

export function GameCard({ game }: { game: GameRow }) {
  const router = useRouter();
  const final = game.status === "final" || game.status === "forfeit";
  const showScore = game.status !== "scheduled" && game.status !== "postponed";

  const status =
    game.status === "live"
      ? { text: "Live", tone: color.accent }
      : final
        ? { text: game.status === "forfeit" ? "Forfeit" : "Final", tone: color.ink }
        : game.status === "postponed"
          ? { text: "Postponed", tone: color.accent }
          : game.is_playoff
            ? { text: "Playoff", tone: color.bench }
            : null;

  return (
    <Pressable
      onPress={() => router.push(`/game/${game.id}`)}
      style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}
    >
      <View style={s.header}>
        <Text style={[type.label, { flex: 1 }]} numberOfLines={1}>
          {formatDate(game.scheduled_date)}
          {game.time_slot?.label ? ` · ${game.time_slot.label}` : ""}
          {game.venue?.name ? ` · ${game.venue.name}` : ""}
        </Text>
        {status ? (
          <View style={s.statusRow}>
            {game.status === "live" ? <View style={s.liveDot} /> : null}
            <Text style={[type.label, { color: status.tone }]}>{status.text}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ gap: space(0.75) }}>
        <Side
          name={game.home_team?.name ?? "TBD"}
          abbrev={game.home_team?.abbrev ?? "?"}
          teamColor={game.home_team?.color ?? color.bench}
          score={game.home_score}
          showScore={showScore}
          won={final && game.home_score > game.away_score}
        />
        <Side
          name={game.away_team?.name ?? "TBD"}
          abbrev={game.away_team?.abbrev ?? "?"}
          teamColor={game.away_team?.color ?? color.bench}
          score={game.away_score}
          showScore={showScore}
          won={final && game.away_score > game.home_score}
        />
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: color.paper,
    borderRadius: radius.row,
    padding: space(2),
    gap: space(1.25),
  },
  header: { flexDirection: "row", alignItems: "center", gap: space(1) },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: color.accent,
  },
  side: { flexDirection: "row", alignItems: "center", gap: space(1.25) },
});
