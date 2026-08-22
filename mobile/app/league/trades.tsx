/**
 * Trades from the phone: read every proposal, and answer the ones aimed at
 * your team.
 *
 * Both writes are RPCs (`propose_trade`, `respond_trade`) that own the whole
 * rule set — who may propose, who may accept, roster limits, the league's
 * commissioner-approval setting. This screen decides what to show, never
 * what is allowed.
 */
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Button, Card, EmptyState, ErrorNote, Label, Notice } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { loadLeagueContext } from "@/lib/active-league";
import {
  getTeams,
  getTeamsWithRosters,
  getTrades,
  proposeTrade,
  respondTrade,
  type TradeRow,
} from "@/lib/data";
import type { TeamRow, TeamWithRoster } from "@core/types";
import { color, space, type } from "@/theme";

const STATUS_LABEL: Record<string, string> = {
  proposed: "Waiting",
  accepted: "Accepted",
  rejected: "Rejected",
  executed: "Done",
  cancelled: "Cancelled",
};

export default function Trades() {
  const { user } = useAuth();
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [rosters, setRosters] = useState<TeamWithRoster[]>([]);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [captain, setCaptain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Proposal draft
  const [withTeam, setWithTeam] = useState<string | null>(null);
  const [offer, setOffer] = useState<string[]>([]);
  const [want, setWant] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    const ctx = await loadLeagueContext(user.id);
    if (!ctx || !ctx.seasonId) { setLoaded(true); return; }
    setMyTeamId(ctx.team?.team_id ?? null);
    setSeasonId(ctx.seasonId);
    const [t, ts, rs] = await Promise.all([
      getTrades(ctx.seasonId),
      getTeams(ctx.seasonId),
      getTeamsWithRosters(ctx.seasonId),
    ]);
    setTrades(t);
    setTeams(ts);
    setRosters(rs);
    // Proposing is the captain's, and the RPC says so; reading is everyone's.
    setCaptain(ts.some((x) => x.captain_id === user.id));
    setLoaded(true);
  }, [user]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const nameOf = (id: string) => teams.find((t) => t.id === id)?.name ?? "—";
  const rosterOf = (id: string | null) =>
    rosters.find((r) => r.id === id)?.roster.filter((p) => !p.is_guest) ?? [];

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  async function respond(id: string, accept: boolean) {
    setError(null);
    const err = await respondTrade(id, accept);
    if (err) setError(err);
    else {
      setNotice(accept ? "Trade accepted." : "Trade rejected.");
      void load();
    }
  }

  async function send() {
    if (!seasonId || !myTeamId || !withTeam) return;
    if (offer.length === 0 || want.length === 0) {
      setError("Pick at least one player on each side.");
      return;
    }
    setError(null);
    const err = await proposeTrade({
      seasonId,
      fromTeamId: myTeamId,
      toTeamId: withTeam,
      offer,
      request: want,
      note: "",
    });
    if (err) { setError(err); return; }
    setOffer([]);
    setWant([]);
    setWithTeam(null);
    setNotice("Trade proposed.");
    void load();
  }

  const chip = (active: boolean) => ({
    borderRadius: 999,
    paddingHorizontal: space(1.5),
    paddingVertical: space(0.9),
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
      contentContainerStyle={{ padding: space(2), gap: space(2), paddingBottom: space(6) }}
      keyboardShouldPersistTaps="handled"
    >
      <ErrorNote message={error} />
      <Notice message={notice} />

      {captain && myTeamId ? (
        <Card style={{ gap: space(1.5) }}>
          <Label>Propose a trade</Label>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(1) }}>
            {teams
              .filter((t) => t.id !== myTeamId && !t.is_external)
              .map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => {
                    setWithTeam(t.id === withTeam ? null : t.id);
                    setWant([]);
                  }}
                  style={chip(withTeam === t.id)}
                >
                  <Text style={chipText(withTeam === t.id)}>{t.name}</Text>
                </Pressable>
              ))}
          </View>

          {withTeam ? (
            <>
              <Label>You give</Label>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(1) }}>
                {rosterOf(myTeamId).map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => toggle(offer, setOffer, p.user_id)}
                    style={chip(offer.includes(p.user_id))}
                  >
                    <Text style={chipText(offer.includes(p.user_id))}>{p.full_name}</Text>
                  </Pressable>
                ))}
              </View>
              <Label>You get</Label>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(1) }}>
                {rosterOf(withTeam).map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => toggle(want, setWant, p.user_id)}
                    style={chip(want.includes(p.user_id))}
                  >
                    <Text style={chipText(want.includes(p.user_id))}>{p.full_name}</Text>
                  </Pressable>
                ))}
              </View>
              <Button variant="accent" onPress={send}>Propose it</Button>
            </>
          ) : null}
        </Card>
      ) : null}

      {trades.length === 0 ? (
        <Card>
          <EmptyState
            title={loaded ? "No trades yet" : "Loading…"}
            body={loaded ? "Captains can propose a swap from here." : undefined}
          />
        </Card>
      ) : (
        trades.map((t) => {
          const mineIn = t.to_team_id === myTeamId;
          const answerable = captain && mineIn && t.status === "proposed";
          return (
            <Card key={t.id} style={{ gap: space(1) }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space(1) }}>
                <Text style={[type.bodyMedium, { flex: 1, color: color.ink }]} numberOfLines={1}>
                  {nameOf(t.from_team_id)} → {nameOf(t.to_team_id)}
                </Text>
                <Label style={t.status === "proposed" ? { color: color.blush } : undefined}>
                  {STATUS_LABEL[t.status] ?? t.status}
                </Label>
              </View>
              {t.items.map((it) => (
                <Text key={`${t.id}-${it.user_id}`} style={[type.small, { color: color.inkBody }]}>
                  {it.full_name} · {nameOf(it.from_team_id)} → {nameOf(it.to_team_id)}
                </Text>
              ))}
              {answerable ? (
                <View style={{ flexDirection: "row", gap: space(1), marginTop: space(0.5) }}>
                  <View style={{ flex: 1 }}>
                    <Button variant="accent" onPress={() => respond(t.id, true)}>Accept</Button>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button variant="quiet" onPress={() => respond(t.id, false)}>Reject</Button>
                  </View>
                </View>
              ) : null}
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}
