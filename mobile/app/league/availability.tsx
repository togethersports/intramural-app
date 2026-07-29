import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Card, EmptyState, ErrorNote, H2, Label } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { getMyAvailability, getMyTeams, getTimeSlots, setAvailability } from "@/lib/data";
import { color, radius, space, type, HIT } from "@/theme";
import type { TimeSlotRow } from "@core/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type Status = "yes" | "maybe" | "no";
const OPTIONS: { value: Status; label: string; bg: string; fg: string }[] = [
  { value: "yes", label: "In", bg: color.ink, fg: color.white },
  { value: "maybe", label: "Maybe", bg: color.bench, fg: color.white },
  { value: "no", label: "Out", bg: color.tint, fg: color.accent },
];

export default function Availability() {
  const { user } = useAuth();
  const [slots, setSlots] = useState<TimeSlotRow[]>([]);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, Status>>({});
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const teams = await getMyTeams(user.id);
    if (teams.length === 0) { setLoaded(true); return; }
    setSeasonId(teams[0].season_id);
    const [sl, mine] = await Promise.all([
      getTimeSlots(teams[0].league_id),
      getMyAvailability(teams[0].season_id, user.id),
    ]);
    setSlots(sl);
    setPicked(Object.fromEntries(mine.map((a) => [a.time_slot_id as string, a.status as Status])));
    setLoaded(true);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  /* Optimistic, but unlike the web version it ROLLS BACK on failure — on
     school wifi a silent failure means the scheduler never sees you. */
  const choose = async (slotId: string, status: Status) => {
    if (!user || !seasonId) return;
    const prev = picked[slotId];
    setPicked((p) => ({ ...p, [slotId]: status }));
    setError(null);
    const err = await setAvailability(user.id, seasonId, slotId, status);
    if (err) {
      setPicked((p) => ({ ...p, [slotId]: prev }));
      setError("That didn't save. Check your connection and tap again.");
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space(2), gap: space(2) }}>
      <Card style={{ gap: space(1.5) }}>
        <View>
          <H2>My availability</H2>
          <Text style={[type.body, { color: color.inkBody, marginTop: 2 }]}>
            Tap once per slot. The scheduler only places games when both teams can field players.
          </Text>
        </View>
        <ErrorNote message={error} />
        {slots.length === 0 ? (
          <EmptyState
            title={loaded ? "No time slots yet" : "Loading…"}
            body={loaded ? "Your commissioner hasn't defined lunch or free periods yet." : undefined}
          />
        ) : (
          slots.map((slot) => (
            <View key={slot.id} style={{
              backgroundColor: color.paper, borderRadius: radius.row,
              padding: space(1.75), gap: space(1.25),
            }}>
              <View>
                <Text style={[type.bodyMedium, { color: color.ink }]}>{slot.label}</Text>
                <Text style={[type.small, { color: color.inkMuted }]}>
                  {DAYS[slot.day_of_week]} · {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: space(0.75) }}>
                {OPTIONS.map((o) => {
                  const on = picked[slot.id] === o.value;
                  return (
                    <Pressable
                      key={o.value}
                      onPress={() => choose(slot.id, o.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      style={{
                        flex: 1, minHeight: HIT, borderRadius: radius.control,
                        alignItems: "center", justifyContent: "center",
                        backgroundColor: on ? o.bg : color.surface,
                      }}
                    >
                      <Text style={{
                        fontFamily: type.bodyMedium.fontFamily, fontSize: 15,
                        color: on ? o.fg : color.inkMuted,
                      }}>{o.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}
