"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Subscribes viewers to the game's event stream and refreshes the page. */
export function LiveRefresher({ gameId, live }: { gameId: string; live: boolean }) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`game:${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_events", filter: `game_id=eq.${gameId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        refresh,
      )
      .subscribe();
    const poll = live ? setInterval(refresh, 8000) : undefined;
    return () => {
      supabase.removeChannel(channel);
      if (poll) clearInterval(poll);
    };
  }, [gameId, live, refresh]);

  return null;
}
