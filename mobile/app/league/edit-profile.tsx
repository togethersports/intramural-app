/**
 * Edit your own face and name, from the phone.
 *
 * The photo goes to the same place the web puts it — the public `avatars`
 * bucket, under your own user-id folder, which is the only folder storage
 * RLS lets you write. The stored name is derived and cache-busted, never
 * taken from the picker: filenames are attacker-controlled and the bucket
 * is public. Same rules as lib/uploads.ts on the web, because they are the
 * same bucket and the same policies.
 */
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Avatar, Button, Card, ErrorNote, Field, Input, Notice } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { invalidateIdentity } from "@/lib/profile";
import { supabase } from "@/lib/supabase";
import { color, space, type } from "@/theme";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** Hermes ships atob; this turns the picker's base64 into upload bytes. */
function bytesFromBase64(b64: string): Uint8Array {
  const binary = globalThis.atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export default function EditProfile() {
  const { user } = useAuth();
  const [name, setName] = useState<string | null>(null);
  const [grade, setGrade] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user || name !== null) return;
    const { data } = await supabase
      .from("profiles")
      .select("full_name, grade, avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    setName((data?.full_name as string) ?? "");
    setGrade(data?.grade ? String(data.grade) : "");
    setAvatarUrl((data?.avatar_url as string | null) ?? null);
  }, [user, name]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const pickPhoto = async () => {
    if (!user) return;
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    const asset = result.assets[0];
    const bytes = bytesFromBase64(asset.base64!);
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      setError("That photo is over 4 MB — pick a smaller one.");
      return;
    }
    const ext = asset.mimeType === "image/png" ? "png" : "jpg";
    // Own-folder path per storage RLS; cache-busted so the CDN can't serve
    // the photo this one replaces.
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, bytes.buffer as ArrayBuffer, {
        contentType: asset.mimeType ?? "image/jpeg",
        upsert: true,
      });
    if (upErr) {
      setError(`Couldn't upload the photo: ${upErr.message}`);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: dbErr } = await supabase
      .from("profiles")
      .update({ avatar_url: data.publicUrl })
      .eq("id", user.id);
    if (dbErr) {
      setError(dbErr.message);
      return;
    }
    setAvatarUrl(data.publicUrl);
    invalidateIdentity();
  };

  const save = async () => {
    if (!user) return;
    const trimmed = (name ?? "").trim();
    if (!trimmed) {
      setError("Your name can't be blank — it's what your team sees.");
      return;
    }
    const gradeNum = grade.trim() === "" ? null : parseInt(grade, 10);
    if (gradeNum !== null && (Number.isNaN(gradeNum) || gradeNum < 1 || gradeNum > 12)) {
      setError("Grade should be a number from 1 to 12, or blank.");
      return;
    }
    setSaving(true);
    setError(null);
    const { error: dbErr } = await supabase
      .from("profiles")
      .update({ full_name: trimmed, grade: gradeNum })
      .eq("id", user.id);
    setSaving(false);
    if (dbErr) {
      setError(dbErr.message);
      return;
    }
    invalidateIdentity();
    setNotice("Saved.");
    setTimeout(() => router.back(), 700);
  };

  const removePhoto = () => {
    Alert.alert("Remove your photo?", "Your initials take its place.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          if (!user) return;
          await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
          setAvatarUrl(null);
          invalidateIdentity();
        },
      },
    ]);
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: space(2.5), gap: space(2) }}
      keyboardShouldPersistTaps="handled"
    >
      <Card style={{ gap: space(2), alignItems: "center" }}>
        <Pressable onPress={pickPhoto} hitSlop={8}>
          <Avatar name={name || "?"} size={96} uri={avatarUrl} />
        </Pressable>
        <View style={{ flexDirection: "row", gap: space(1.5) }}>
          <Button variant="quiet" onPress={pickPhoto}>
            {avatarUrl ? "Change photo" : "Add photo"}
          </Button>
          {avatarUrl ? (
            <Button variant="quiet" onPress={removePhoto}>
              Remove
            </Button>
          ) : null}
        </View>
      </Card>

      <Card style={{ gap: space(2) }}>
        <ErrorNote message={error} />
        <Notice message={notice} />
        <Field label="Name">
          <Input
            value={name ?? ""}
            onChangeText={setName}
            placeholder="Your name"
            autoComplete="name"
            maxLength={80}
          />
        </Field>
        <Field label="Grade" hint="Optional — shows next to your name on rosters.">
          <Input
            value={grade}
            onChangeText={setGrade}
            placeholder="9"
            keyboardType="number-pad"
            maxLength={2}
          />
        </Field>
        <Button variant="accent" onPress={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </Card>

      <Text style={[type.small, { color: color.inkFaint, textAlign: "center" }]}>
        Positions and jersey number are set by your captain from the team page.
      </Text>
    </ScrollView>
  );
}
