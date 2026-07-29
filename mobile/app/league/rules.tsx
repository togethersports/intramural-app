import { useCallback, useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Card, EmptyState, H2, Label, Row } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { getLeagueRules, getMyLeagues, getRuleFiles, signedRuleUrl } from "@/lib/data";
import { color, space, type } from "@/theme";

function bytes(n: number) {
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

export default function Rules() {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<{ id: string; name: string; storage_path: string; size_bytes: number }[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const leagues = await getMyLeagues();
    if (leagues.length === 0) { setLoaded(true); return; }
    const [c, f] = await Promise.all([
      getLeagueRules(leagues[0].id),
      getRuleFiles(leagues[0].id),
    ]);
    setContent(c);
    setFiles(f as never);
    setLoaded(true);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = async (path: string) => {
    const url = await signedRuleUrl(path);
    if (url) Linking.openURL(url);
  };

  const sections = content.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);

  return (
    <ScrollView contentContainerStyle={{ padding: space(2), gap: space(2) }}>
      <Card style={{ gap: space(1.5) }}>
        <H2>League rules</H2>
        {sections.length === 0 ? (
          <EmptyState
            title={loaded ? "No rules posted yet" : "Loading…"}
            body={loaded ? "Your commissioner hasn't written the rules. Until then, house rules apply." : undefined}
          />
        ) : (
          sections.map((sec, i) => (
            <Row key={i}>
              {sec.split("\n").map((line, j) => (
                <Text key={j} style={[type.body, { color: color.inkBody }]}>{line}</Text>
              ))}
            </Row>
          ))
        )}
      </Card>

      {files.length > 0 ? (
        <Card style={{ gap: space(1) }}>
          <H2>Documents</H2>
          {files.map((f) => (
            <Pressable key={f.id} onPress={() => open(f.storage_path)}>
              <Row style={{ flexDirection: "row", alignItems: "center", gap: space(1.5) }}>
                <Label style={{ width: 52 }}>
                  {f.name.split(".").pop()?.toUpperCase().slice(0, 4) ?? "FILE"}
                </Label>
                <Text numberOfLines={1} style={[type.bodyMedium, { flex: 1, color: color.ink }]}>
                  {f.name}
                </Text>
                <Text style={[type.label]}>{bytes(f.size_bytes)}</Text>
              </Row>
            </Pressable>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}
