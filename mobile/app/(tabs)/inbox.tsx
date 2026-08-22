import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Button, Card, EmptyState, H2, Label, Row } from "@/components/ui";
import { getNotifications, markAllRead } from "@/lib/data";
import { ScreenHeader } from "@/components/ScreenHeader";
import { TAB_CLEARANCE, useBarScroll } from "@/lib/scroll";
import { color, space, type } from "@/theme";
import type { NotificationRow } from "@core/types";

// No emoji, ever — the mono category label carries it (brandbook 07).
/** "Aug 21, 9:11 PM" — the same shape the web inbox prints. */
function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const CATEGORY: Record<string, string> = {
  draft_clock: "Draft",
  trade: "Trade",
  final_score: "Final",
  schedule_change: "Schedule",
  availability_nudge: "Availability",
  scorekeeper: "Scorekeeper",
  announcement: "League",
};

/** Notification links are web paths; map the ones the app can handle. */
function routeFor(link: string | null): string | null {
  if (!link) return null;
  const game = link.match(/\/game\/([0-9a-f-]{36})/i);
  if (game) return `/game/${game[1]}`;
  if (link.includes("/availability")) return "/league/availability";
  if (link.includes("/rules")) return "/league/rules";
  return null;
}

export default function Inbox() {
  const router = useRouter();
  const onScroll = useBarScroll();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setItems(await getNotifications());
    setLoaded(true);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const unread = items.filter((n) => !n.read_at).length;

  return (
    <ScrollView
      onScroll={onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{ padding: space(2), paddingTop: insets.top + space(1), gap: space(2), paddingBottom: TAB_CLEARANCE }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.ink} />}
    >
      <ScreenHeader title="Inbox" />
      {unread > 0 ? (
        <Button variant="canvas" onPress={async () => { await markAllRead(); load(); }}>
          Mark all read
        </Button>
      ) : null}
      <Card style={{ gap: space(1) }}>
        {items.length === 0 ? (
          <EmptyState
            title={loaded ? "Nothing yet" : "Loading…"}
            body={loaded ? "Game finals, trade offers, draft alerts and schedule changes land here." : undefined}
          />
        ) : (
          items.map((n) => {
            const route = routeFor(n.link);
            const body = (
              /* The category used to stand in a column of its own beside the
                 message, so one word like SCOREKEEPER squeezed every line
                 next to it. It sits under the message now, with the time —
                 the words get the width. */
              <Row style={{ flexDirection: "row", gap: space(1.5), alignItems: "flex-start" }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[n.read_at ? type.body : type.bodyMedium, { color: color.ink }]}>
                    {n.title}
                  </Text>
                  {n.body ? (
                    <Text style={[type.small, { color: color.inkBody }]}>{n.body}</Text>
                  ) : null}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space(0.75), marginTop: 3 }}>
                    <Label numberOfLines={1}>{CATEGORY[n.category] ?? "Update"}</Label>
                    <Text style={[type.small, { fontSize: 12, color: color.inkFaint }]}>·</Text>
                    <Text style={[type.small, { fontSize: 12, color: color.inkFaint }]}>
                      {formatWhen(n.created_at)}
                    </Text>
                  </View>
                </View>
                {!n.read_at ? (
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color.accent, marginTop: 6 }} />
                ) : null}
              </Row>
            );
            return route ? (
              <Pressable key={n.id} onPress={() => router.push(route as never)}>{body}</Pressable>
            ) : (
              <View key={n.id}>{body}</View>
            );
          })
        )}
      </Card>
    </ScrollView>
  );
}
