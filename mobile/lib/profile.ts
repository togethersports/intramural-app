/**
 * The signed-in person's face and name, cached once for the whole app.
 *
 * The header on every screen and the tab bar's profile icon both need the
 * avatar; fetching it per-screen would mean five identical requests per
 * cold start. Module cache with subscribers, invalidated on sign-out by
 * keying the cache to the user id.
 */

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export interface MyIdentity {
  name: string;
  avatarUrl: string | null;
}

let cachedFor: string | null = null;
let cached: MyIdentity | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

async function fetchIdentity(userId: string): Promise<void> {
  const { data } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", userId)
    .maybeSingle();
  cachedFor = userId;
  cached = {
    name: (data?.full_name as string) ?? "",
    avatarUrl: (data?.avatar_url as string | null) ?? null,
  };
  listeners.forEach((l) => l());
}

/** Call after the profile screen edits the name/photo, so the header and
    tab bar update without an app restart. */
export function invalidateIdentity(): void {
  cachedFor = null;
  cached = null;
  inflight = null;
}

export function useMyIdentity(userId: string | undefined): MyIdentity | null {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  useEffect(() => {
    if (!userId) return;
    if (cachedFor === userId) return;
    if (!inflight) {
      inflight = fetchIdentity(userId).finally(() => {
        inflight = null;
      });
    }
  }, [userId]);
  return cachedFor === userId ? cached : null;
}
