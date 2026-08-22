/**
 * The rules, on the page.
 *
 * A rulebook you have to download and open in another app is a rulebook
 * nobody reads mid-argument. The league's rule sheet renders here, in the
 * screen, and the rest of the documents stay below it as a list.
 */
import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import * as WebBrowser from "expo-web-browser";
import { loadLeagueContext } from "@/lib/active-league";
import { useFocusEffect } from "expo-router";
import { Card, EmptyState, H2, Label, Row } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { getLeagueRules, getRuleFiles, signedRuleUrl } from "@/lib/data";
import { color, radius, space, type } from "@/theme";

interface RuleFile {
  id: string;
  name: string;
  storage_path: string;
  size_bytes: number;
  is_primary?: boolean | null;
}

function bytes(n: number) {
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

/** Only these render in a web view — everything else is a download. */
function kindOf(name: string): "pdf" | "image" | "other" {
  if (name.toLowerCase().endsWith(".pdf")) return "pdf";
  if (/\.(png|jpe?g|webp|gif)$/i.test(name)) return "image";
  return "other";
}

export default function Rules() {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<RuleFile[]>([]);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const ctx = await loadLeagueContext(user.id);
    if (!ctx) { setLoaded(true); return; }
    const leagueId = ctx.league.id;
    const [c, f] = await Promise.all([
      getLeagueRules(leagueId),
      getRuleFiles(leagueId),
    ]);
    setContent(c);
    setFiles(f as RuleFile[]);
    setLoaded(true);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // The pinned document wins; failing that, the newest one we can draw. The
  // list already arrives in that order, so first-match is the whole rule.
  const sheet =
    files.find((f) => f.is_primary && kindOf(f.name) !== "other") ??
    files.find((f) => kindOf(f.name) !== "other") ??
    null;

  // Signing is a network call, so it happens once the sheet is known rather
  // than on every render.
  useEffect(() => {
    let live = true;
    if (!sheet) { setSheetUrl(null); return; }
    void signedRuleUrl(sheet.storage_path).then((u) => {
      if (live) setSheetUrl(u);
    });
    return () => { live = false; };
  }, [sheet?.storage_path]);

  // For anything the web view cannot draw, and for a full-screen read of
  // something it can: Safari as a sheet over Intramural, not a handoff that
  // loses the app.
  const open = async (path: string) => {
    const url = await signedRuleUrl(path);
    if (!url) return;
    try {
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        controlsColor: color.accent,
        toolbarColor: color.canvas,
      });
    } catch {
      Linking.openURL(url);
    }
  };

  const sections = content.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);

  return (
    <ScrollView contentContainerStyle={{ padding: space(2), gap: space(2) }}>
      {sheet ? (
        <Card style={{ gap: space(1.25) }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space(1) }}>
            <Text numberOfLines={1} style={[type.h2, { flex: 1, color: color.ink }]}>
              {sheet.name}
            </Text>
            <Pressable onPress={() => open(sheet.storage_path)} hitSlop={8}>
              <Text style={[type.small, { color: color.accent, fontWeight: "600" }]}>
                Full screen
              </Text>
            </Pressable>
          </View>
          <View
            style={{
              height: 460,
              borderRadius: radius.control,
              overflow: "hidden",
              backgroundColor: color.canvas,
            }}
          >
            {sheetUrl ? (
              <WebView
                source={{ uri: sheetUrl }}
                // The document scrolls inside its own frame; the page around
                // it keeps scrolling normally.
                nestedScrollEnabled
                originWhitelist={["https://*"]}
                style={{ flex: 1, backgroundColor: color.canvas }}
              />
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <Text style={[type.small, { color: color.inkFaint }]}>
                  Loading the rule sheet…
                </Text>
              </View>
            )}
          </View>
        </Card>
      ) : null}

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
