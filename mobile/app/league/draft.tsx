/**
 * The draft room, on the phone.
 *
 * This is the screen with a clock: a draft runs live, and missing a pick
 * because you were not at a laptop costs you a player you cannot get back.
 * So it live-subscribes to picks, shows who is on the clock, and lets the
 * team whose turn it is take someone with one tap.
 *
 * Every rule — pick order, eligibility, roster limits, whether it is even
 * your turn — belongs to make_pick(). This screen shows the board and
 * sends one id; the database refuses anything it should refuse.
 */
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Avatar, Card, EmptyState, ErrorNote, Label, Num } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { getActiveLeague, resolveTeam } from "@/lib/active-league";
import {
  draftPickTeam,
  getDraft,
  getDraftPicks,
  getLeagueMembers,
  getMyTeams,
  getTeams,
  makeDraftPick,
  type DraftPickRow,
  type DraftRow,
  type LeagueMemberRow,
} from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { TeamRow } from "@core/types";
import { color, space, type } from "@/theme";

export default function Draft() {
  const { user } = useAuth();
  const [draft, setDraft] = useState<DraftRow | null>(null);
  const [picks, setPicks] = useState<DraftPickRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [members, setMembers] = useState<LeagueMemberRow[]>([]);
  const [onClock, setOnClock] = useState<string | null>(null);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const mine = resolveTeam(await getMyTeams(user.id), getActiveLeague());
    if (!mine) { setLoaded(true); return; }
    setMyTeamId(mine.team_id);
    const d = await getDraft(mine.season_id);
    setDraft(d);
    if (!d) { setLoaded(true); return; }
    const [p, ts, ms, clock] = await Promise.all([
      getDraftPicks(d.id),
      getTeams(mine.season_id),
      getLeagueMembers(mine.league_id),
      draftPickTeam(d.id, d.current_pick_no),
    ]);
    setPicks(p);
    setTeams(ts);
    setMembers(ms);
    setOnClock(clock);
    setLoaded(true);
  }, [user]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  // A draft board that only updates when you pull it is a board you cannot
  // trust — every pick anyone makes lands here immediately.
  useEffect(() => {
    if (!draft || draft.status !== "live") return;
    const channel = supabase
      .channel(`draft-${draft.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "draft_picks", filter: `draft_id=eq.${draft.id}` },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drafts", filter: `id=eq.${draft.id}` },
        () => void load(),
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [draft, load]);

  const taken = new Set(picks.map((p) => p.user_id));
  const available = members
    .filter((m) => (m.role === "player" || m.role === "captain") && !taken.has(m.user_id))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
  const myPick = onClock != null && onClock === myTeamId;
  const nameOfTeam = (id: string | null) =>
    id ? (teams.find((t) => t.id === id)?.name ?? "—") : "—";

  async function pick(userId: string) {
    if (!draft) return;
    setError(null);
    const err = await makeDraftPick(draft.id, userId);
    if (err) setError(err);
    else void load();
  }

  if (!draft) {
    return (
      <ScrollView contentContainerStyle={{ padding: space(2.5) }}>
        <Card>
          <EmptyState
            title={loaded ? "No draft" : "Loading…"}
            body={loaded ? "This season has no draft set up." : undefined}
          />
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space(2), gap: space(2), paddingBottom: space(6) }}>
      <ErrorNote message={error} />

      <Card style={{ gap: space(0.5), alignItems: "center" }}>
        <Label>{draft.status === "live" ? "On the clock" : `Draft ${draft.status}`}</Label>
        <Text style={[type.h1, { color: myPick ? color.accent : color.ink }]} numberOfLines={1}>
          {myPick ? "Your pick" : nameOfTeam(onClock)}
        </Text>
        <Text style={[type.small, { color: color.inkFaint }]}>
          Pick <Num size={13}>{draft.current_pick_no}</Num> · round{" "}
          <Num size={13}>
            {Math.floor((draft.current_pick_no - 1) / Math.max(1, draft.pick_order.length)) + 1}
          </Num>{" "}
          of <Num size={13}>{draft.rounds}</Num>
        </Text>
      </Card>

      <Card style={{ gap: space(1) }}>
        <Label>Available</Label>
        {available.length === 0 ? (
          <Text style={[type.small, { color: color.inkFaint }]}>Everyone has been drafted.</Text>
        ) : (
          available.map((m) => (
            <Pressable
              key={m.user_id}
              disabled={!myPick || draft.status !== "live"}
              onPress={() => pick(m.user_id)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space(1.25),
                paddingVertical: space(1),
                paddingHorizontal: space(1.25),
                borderRadius: 14,
                backgroundColor: myPick ? color.paper : "transparent",
                opacity: myPick ? 1 : 0.75,
              }}
            >
              <Avatar name={m.full_name} size={30} uri={m.avatar_url ?? undefined} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[type.bodyMedium, { color: color.ink }]} numberOfLines={1}>
                  {m.full_name}
                </Text>
                {m.grade ? (
                  <Text style={[type.small, { color: color.inkFaint }]}>Grade {m.grade}</Text>
                ) : null}
              </View>
              {myPick ? (
                <Text style={[type.small, { color: color.accent, fontWeight: "600" }]}>Draft</Text>
              ) : null}
            </Pressable>
          ))
        )}
      </Card>

      <Card style={{ gap: space(0.75) }}>
        <Label>The board</Label>
        {picks.length === 0 ? (
          <Text style={[type.small, { color: color.inkFaint }]}>No picks yet.</Text>
        ) : (
          [...picks].reverse().map((p) => (
            <View
              key={p.pick_no}
              style={{ flexDirection: "row", alignItems: "center", gap: space(1) }}
            >
              <Num size={13} style={{ width: 28, color: color.inkFaint }}>
                {p.pick_no}
              </Num>
              <Text style={[type.body, { flex: 1, color: color.ink }]} numberOfLines={1}>
                {p.full_name}
              </Text>
              <Text style={[type.small, { color: color.inkFaint }]} numberOfLines={1}>
                {nameOfTeam(p.team_id)}
                {p.auto_picked ? " · auto" : ""}
              </Text>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}
