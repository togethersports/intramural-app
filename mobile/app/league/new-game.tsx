/**
 * A game, made on the spot, from the phone.
 *
 * The case this exists for: two teams are standing in the gym and nobody
 * has a laptop. Pick the sides, pick the day, done — the game appears on
 * the schedule and can be tracked live from the same phone.
 *
 * Exhibition by default. A pickup game that lands in the standings by
 * accident is a mess to unpick, and the game page can promote it to
 * official in one tap later if it turns out to have counted.
 *
 * There is no server action here: `games: admins write` is the same RLS
 * policy the web console writes through, so the insert is the whole
 * operation and the database is the authority either way.
 */
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Button, Card, ErrorNote, Field, Input, Notice } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { getActiveLeague, resolveTeam } from "@/lib/active-league";
import { getActiveSeason, getMyTeams, getTeams, getTimeSlots } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { color, radius, space, type } from "@/theme";
import type { TeamRow, TimeSlotRow } from "@core/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Local YYYY-MM-DD — never toISOString, which would roll the date over in
    the evening for anyone west of UTC. */
function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function dayLabel(d: Date, index: number): string {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  return `${DAYS[d.getDay()]} ${d.getDate()}`;
}

export default function NewGame() {
  const { user } = useAuth();
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [slots, setSlots] = useState<TimeSlotRow[]>([]);
  const [home, setHome] = useState<string | null>(null);
  const [away, setAway] = useState<string | null>(null);
  const [visitor, setVisitor] = useState("");
  const [dayOffset, setDayOffset] = useState(0);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [official, setOfficial] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user || seasonId) return;
    const mine = resolveTeam(await getMyTeams(user.id), getActiveLeague());
    if (!mine) {
      setError("You need a team in a league before you can make a game.");
      return;
    }
    setLeagueId(mine.league_id);
    const season = await getActiveSeason(mine.league_id);
    const sid = season?.id ?? mine.season_id;
    setSeasonId(sid);
    const [ts, sl] = await Promise.all([getTeams(sid), getTimeSlots(mine.league_id)]);
    setTeams(ts);
    setSlots(sl);
    setHome(mine.team_id);
  }, [user, seasonId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  async function create() {
    if (!seasonId || !home) {
      setError("Pick the home team first.");
      return;
    }
    const named = visitor.trim();
    if (!away && named.length < 2) {
      setError("Pick an opponent, or type the name of a visiting team.");
      return;
    }
    if (away && away === home) {
      setError("A team cannot play itself.");
      return;
    }
    setSaving(true);
    setError(null);

    let opponent = away;
    // A free-text opponent becomes a real team row flagged external, exactly
    // as the web does it — that is what lets the whole stats pipeline work
    // for a team with no roster.
    if (!opponent) {
      const { data: existing } = await supabase
        .from("teams")
        .select("id")
        .eq("season_id", seasonId)
        .eq("is_external", true)
        .ilike("name", named)
        .maybeSingle();
      if (existing) {
        opponent = existing.id as string;
      } else {
        const { data: created, error: teamErr } = await supabase
          .from("teams")
          .insert({
            season_id: seasonId,
            name: named.slice(0, 60),
            abbrev:
              named.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() || "VIS",
            color: "#5A6472",
            is_external: true,
          })
          .select("id")
          .single();
        if (teamErr || !created) {
          setSaving(false);
          setError(teamErr?.message ?? "Could not create the visiting team.");
          return;
        }
        opponent = created.id as string;
      }
    }

    const { data, error: gameErr } = await supabase
      .from("games")
      .insert({
        season_id: seasonId,
        week: 1,
        home_team_id: home,
        away_team_id: opponent,
        scheduled_date: isoDay(days[dayOffset]),
        time_slot_id: slotId,
        is_adhoc: true,
        counts_for_standings: official,
        status: "scheduled",
      })
      .select("id")
      .single();
    setSaving(false);
    if (gameErr || !data) {
      setError(gameErr?.message ?? "Could not create the game.");
      return;
    }
    setNotice("Game created.");
    router.replace(`/game/${data.id}` as never);
  }

  const chip = (active: boolean) => ({
    borderRadius: 999,
    paddingHorizontal: space(1.75),
    paddingVertical: space(1),
    backgroundColor: active ? color.accent : color.paper,
    borderWidth: 1,
    borderColor: active ? color.accent : color.glassBorder,
  });
  const chipText = (active: boolean) => [
    type.small,
    { color: active ? color.onLight : color.inkBody, fontWeight: "600" as const },
  ];

  return (
    <ScrollView
      contentContainerStyle={{ padding: space(2.5), gap: space(2), paddingBottom: space(6) }}
      keyboardShouldPersistTaps="handled"
    >
      <ErrorNote message={error} />
      <Notice message={notice} />

      <Card style={{ gap: space(1.5) }}>
        <Text style={[type.small, { color: color.inkFaint }]}>HOME</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(1) }}>
          {teams.map((t) => (
            <Pressable key={t.id} onPress={() => setHome(t.id)} style={chip(home === t.id)}>
              <Text style={chipText(home === t.id)}>{t.name}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card style={{ gap: space(1.5) }}>
        <Text style={[type.small, { color: color.inkFaint }]}>AWAY</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(1) }}>
          {teams
            .filter((t) => t.id !== home)
            .map((t) => (
              <Pressable
                key={t.id}
                onPress={() => {
                  setAway(t.id);
                  setVisitor("");
                }}
                style={chip(away === t.id)}
              >
                <Text style={chipText(away === t.id)}>{t.name}</Text>
              </Pressable>
            ))}
        </View>
        <Field label="Or a visiting team" hint="Anyone not in the league — type their name.">
          <Input
            value={visitor}
            onChangeText={(v) => {
              setVisitor(v);
              if (v.trim()) setAway(null);
            }}
            placeholder="Faculty All-Stars"
            maxLength={60}
          />
        </Field>
      </Card>

      <Card style={{ gap: space(1.5) }}>
        <Text style={[type.small, { color: color.inkFaint }]}>WHEN</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(1) }}>
          {days.map((d, i) => (
            <Pressable key={i} onPress={() => setDayOffset(i)} style={chip(dayOffset === i)}>
              <Text style={chipText(dayOffset === i)}>{dayLabel(d, i)}</Text>
            </Pressable>
          ))}
        </View>
        {slots.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(1) }}>
            <Pressable onPress={() => setSlotId(null)} style={chip(slotId === null)}>
              <Text style={chipText(slotId === null)}>No period</Text>
            </Pressable>
            {slots.map((s) => (
              <Pressable key={s.id} onPress={() => setSlotId(s.id)} style={chip(slotId === s.id)}>
                <Text style={chipText(slotId === s.id)}>{s.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Card>

      <Card style={{ gap: space(1.5) }}>
        <Pressable
          onPress={() => setOfficial((o) => !o)}
          style={{ flexDirection: "row", alignItems: "center", gap: space(1.5) }}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: radius.control,
              borderWidth: 2,
              borderColor: official ? color.accent : color.glassBorder,
              backgroundColor: official ? color.accent : "transparent",
            }}
          />
          <View style={{ flex: 1 }}>
            <Text style={[type.bodyMedium, { color: color.ink }]}>
              Count it in the standings
            </Text>
            <Text style={[type.small, { color: color.inkFaint }]}>
              Off by default — a pickup game stays an exhibition. You can
              promote it from the game page later.
            </Text>
          </View>
        </Pressable>
      </Card>

      <Button variant="accent" onPress={create} disabled={saving || !seasonId}>
        {saving ? "Creating…" : "Create the game"}
      </Button>

      {leagueId ? null : (
        <Text style={[type.small, { color: color.inkFaint, textAlign: "center" }]}>
          Loading your league…
        </Text>
      )}
    </ScrollView>
  );
}
