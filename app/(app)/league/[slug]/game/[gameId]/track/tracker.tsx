"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { EVENT_LABELS, PLAYER_EVENTS } from "@/lib/game-constants";
import { computeBoxScore, type GameEventInput } from "@/lib/stats";
import type { GameRow, LineupRow, RosterEntry } from "@/lib/types";
import {
  finalizeGame,
  recordEvent,
  saveLineup,
  setGameState,
  voidEvent,
  type TrackerEvent,
} from "../../../actions";

interface LocalEvent extends TrackerEvent {
  id?: string; // server id once synced
  synced: boolean;
  voided: boolean;
}

interface TeamSide {
  id: string;
  name: string;
  color: string;
  roster: RosterEntry[];
}

const PERIOD_MS = 10 * 60 * 1000;

function loadQueue(gameId: string): LocalEvent[] {
  try {
    return JSON.parse(localStorage.getItem(`tracker:${gameId}`) ?? "[]");
  } catch {
    return [];
  }
}

export function Tracker({
  slug,
  game,
  home,
  away,
  serverEvents,
  lineups,
}: {
  slug: string;
  game: GameRow;
  home: TeamSide;
  away: TeamSide;
  serverEvents: (TrackerEvent & { id: string; voided: boolean })[];
  lineups: LineupRow[];
}) {
  const router = useRouter();

  // ---------------- event store: server events + locally queued ones
  const [events, setEvents] = useState<LocalEvent[]>(() => {
    const server: LocalEvent[] = serverEvents.map((e) => ({ ...e, synced: true }));
    return server;
  });
  const [status, setStatus] = useState(game.status);
  const [period, setPeriod] = useState(Math.max(1, game.period));
  const [clockMs, setClockMs] = useState(game.clock_ms ?? PERIOD_MS);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<{ teamId: string; userId: string } | null>(null);
  const [subMode, setSubMode] = useState<{ teamId: string; out: string } | null>(null);
  const [assistPrompt, setAssistPrompt] = useState<{ teamId: string; scorer: string; eventClientId: string } | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [starters, setStarters] = useState<Record<string, Set<string>>>({
    [home.id]: new Set(lineups.find((l) => l.team_id === home.id)?.on_court ?? []),
    [away.id]: new Set(lineups.find((l) => l.team_id === away.id)?.on_court ?? []),
  });

  // hydrate offline queue after mount (localStorage is client-only);
  // deferred a tick to keep hydration output stable
  useEffect(() => {
    const t = setTimeout(() => {
      const queued = loadQueue(game.id).filter(
        (q) => !serverEvents.some((s) => s.client_uuid === q.client_uuid),
      );
      if (queued.length > 0) setEvents((prev) => [...prev, ...queued]);
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pendingCount = useMemo(
    () => events.filter((e) => !e.synced).length,
    [events],
  );

  // persist unsynced events for offline recovery
  useEffect(() => {
    try {
      localStorage.setItem(
        `tracker:${game.id}`,
        JSON.stringify(events.filter((e) => !e.synced)),
      );
    } catch {
      // storage full/unavailable — sync loop still holds them in memory
    }
  }, [events, game.id]);

  // ---------------- sync loop: retry unsynced events, oldest first
  const syncing = useRef(false);
  const sync = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    try {
      const unsynced = events.filter((e) => !e.synced).sort((a, b) => a.seq - b.seq);
      for (const e of unsynced) {
        const payload: TrackerEvent = {
          seq: e.seq, period: e.period, clock_ms: e.clock_ms,
          team_id: e.team_id, user_id: e.user_id, type: e.type,
          value: e.value, related_user_id: e.related_user_id,
          client_uuid: e.client_uuid,
        };
        const res = await recordEvent(game.id, payload);
        if (res.error) break; // offline or rejected — retry next tick
        setEvents((prev) =>
          prev.map((p) =>
            p.client_uuid === e.client_uuid ? { ...p, synced: true } : p,
          ),
        );
      }
    } finally {
      syncing.current = false;
    }
  }, [events, game.id]);

  useEffect(() => {
    const t = setInterval(sync, 8000);
    window.addEventListener("online", sync);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", sync);
    };
  }, [sync]);

  // ---------------- clock
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setClockMs((ms) => {
        if (ms <= 1000) {
          setRunning(false);
          return 0;
        }
        return ms - 1000;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running]);

  const nextSeq = useMemo(
    () => events.reduce((max, e) => Math.max(max, e.seq), 0) + 1,
    [events],
  );

  const record = useCallback(
    (
      type: string,
      opts: { teamId?: string | null; userId?: string | null; related?: string | null; value?: number | null } = {},
    ): string => {
      const clientId = crypto.randomUUID();
      const evt: LocalEvent = {
        seq: nextSeq,
        period,
        clock_ms: clockMs,
        team_id: opts.teamId ?? null,
        user_id: opts.userId ?? null,
        type,
        value: opts.value ?? null,
        related_user_id: opts.related ?? null,
        client_uuid: clientId,
        synced: false,
        voided: false,
      };
      setEvents((prev) => [...prev, evt]);
      // fire-and-forget; the sync loop covers failures
      recordEvent(game.id, {
        seq: evt.seq, period: evt.period, clock_ms: evt.clock_ms,
        team_id: evt.team_id, user_id: evt.user_id, type: evt.type,
        value: evt.value, related_user_id: evt.related_user_id,
        client_uuid: evt.client_uuid,
      }).then((res) => {
        if (!res.error) {
          setEvents((prev) =>
            prev.map((p) => (p.client_uuid === clientId ? { ...p, synced: true } : p)),
          );
        }
      });
      return clientId;
    },
    [nextSeq, period, clockMs, game.id],
  );

  // ---------------- derived state
  const statInputs: GameEventInput[] = events.map((e) => ({
    seq: e.seq,
    type: e.type,
    team_id: e.team_id,
    user_id: e.user_id,
    related_user_id: e.related_user_id,
    voided: e.voided,
  }));
  const box = computeBoxScore(statInputs, lineups, home.id, away.id);

  // on-court sets derived from starters + subs
  const onCourt = useMemo(() => {
    const sets: Record<string, Set<string>> = {
      [home.id]: new Set(starters[home.id]),
      [away.id]: new Set(starters[away.id]),
    };
    for (const e of [...events].sort((a, b) => a.seq - b.seq)) {
      if (e.type === "sub" && !e.voided && e.team_id && sets[e.team_id]) {
        if (e.related_user_id) sets[e.team_id].delete(e.related_user_id);
        if (e.user_id) sets[e.team_id].add(e.user_id);
      }
    }
    return sets;
  }, [events, starters, home.id, away.id]);

  // ---------------- flows
  const startGame = async () => {
    for (const side of [home, away]) {
      await saveLineup(game.id, side.id, [...starters[side.id]], 0);
    }
    record("period_start", {});
    setStatus("live");
    setRunning(true);
    await setGameState(game.id, { status: "live", period: 1 });
    router.refresh();
  };

  const tapEvent = (type: string) => {
    if (!selected) return;
    const clientId = record(type, {
      teamId: selected.teamId,
      userId: selected.userId,
      value: type === "fg2_made" ? 2 : type === "fg3_made" ? 3 : type === "ft_made" ? 1 : null,
    });
    if (type === "fg2_made" || type === "fg3_made") {
      setAssistPrompt({ teamId: selected.teamId, scorer: selected.userId, eventClientId: clientId });
    }
    setSelected(null);
  };

  const addAssist = (userId: string | null) => {
    if (assistPrompt && userId) {
      record("ast", {
        teamId: assistPrompt.teamId,
        userId,
        related: assistPrompt.scorer,
      });
    }
    setAssistPrompt(null);
  };

  const doSub = (inPlayer: string) => {
    if (!subMode) return;
    record("sub", { teamId: subMode.teamId, userId: inPlayer, related: subMode.out });
    setSubMode(null);
  };

  const undoLast = async () => {
    const last = [...events].filter((e) => !e.voided && e.type !== "period_start").sort((a, b) => b.seq - a.seq)[0];
    if (!last) return;
    setEvents((prev) =>
      prev.map((p) => (p.client_uuid === last.client_uuid ? { ...p, voided: true } : p)),
    );
    if (last.id) await voidEvent(game.id, last.id, true);
    // unsynced events: mark voided locally; they sync then void — simpler to just not send
  };

  const endPeriod = async () => {
    record("period_end", {});
    const rules = { periods: 4 };
    if (period < rules.periods) {
      setPeriod(period + 1);
      setClockMs(PERIOD_MS);
      record("period_start", {});
      await setGameState(game.id, { period: period + 1 });
    } else {
      setRunning(false);
      setConfirmEnd(true);
    }
  };

  const finish = async () => {
    setFinalizing(true);
    await sync();
    const res = await finalizeGame(game.id, slug);
    setFinalizing(false);
    if (!res.error) router.push(`/league/${slug}/game/${game.id}`);
  };

  const mmss = (ms: number) =>
    `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

  /* ------------------------------ pre-game setup ------------------------------ */
  if (status === "scheduled") {
    const toggle = (teamId: string, userId: string) => {
      setStarters((prev) => {
        const next = new Set(prev[teamId]);
        if (next.has(userId)) next.delete(userId);
        else if (next.size < 5) next.add(userId);
        return { ...prev, [teamId]: next };
      });
    };
    const ready =
      starters[home.id].size > 0 &&
      starters[home.id].size <= 5 &&
      starters[away.id].size > 0 &&
      starters[away.id].size <= 5;
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <h2 className="text-xl font-semibold tracking-tight text-white">
          Pick starting fives
        </h2>
        {[home, away].map((side) => (
          <section key={side.id} className="card overflow-hidden">
            <h3
              className="px-4 py-2.5 text-sm font-bold text-white"
              style={{ backgroundColor: side.color }}
            >
              {side.name} — {starters[side.id].size}/5
            </h3>
            <div className="grid grid-cols-2 gap-1.5 p-3">
              {side.roster.map((m) => (
                <button
                  key={m.user_id}
                  onClick={() => toggle(side.id, m.user_id)}
                  className={`min-h-11 rounded-control px-3 text-sm font-semibold ${
                    starters[side.id].has(m.user_id)
                      ? "bg-ink text-surface"
                      : "bg-rule text-ink-body"
                  }`}
                >
                  {m.full_name}
                  {m.jersey_number != null ? ` #${m.jersey_number}` : ""}
                </button>
              ))}
            </div>
          </section>
        ))}
        <Button onClick={startGame} disabled={!ready} variant="accent" className="w-full">
          Tip off
        </Button>
      </div>
    );
  }

  /* ------------------------------- box confirm ------------------------------- */
  if (confirmEnd) {
    const lines = [...box.players.entries()];
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <section className="card p-5 text-center">
          <p className="text-sm font-medium text-ink-body">Confirm final</p>
          <p className="num text-4xl">
            {box.homeScore} — {box.awayScore}
          </p>
          <p className="text-sm text-ink-body">
            {home.name} vs {away.name}
          </p>
          {pendingCount > 0 ? (
            <p className="mt-2 text-xs font-semibold text-accent">
              {pendingCount} events still syncing — they&apos;ll be included.
            </p>
          ) : null}
        </section>
        <section className="card max-h-80 overflow-y-auto p-4">
          {lines
            .sort((a, b) => b[1].pts - a[1].pts)
            .map(([userId, l]) => {
              const name =
                [...home.roster, ...away.roster].find((r) => r.user_id === userId)
                  ?.full_name ?? "—";
              return (
                <p key={userId} className="flex justify-between border-t border-rule py-1.5 text-sm first:border-0">
                  <span className="font-semibold">{name}</span>
                  <span className="tabular text-ink-body">
                    {l.pts} pts · {l.reb} reb · {l.ast} ast ·{" "}
                    {l.plus_minus > 0 ? `+${l.plus_minus}` : l.plus_minus}
                  </span>
                </p>
              );
            })}
        </section>
        <div className="flex gap-2">
          <Button onClick={() => setConfirmEnd(false)} variant="quiet" className="flex-1">
            Back
          </Button>
          <Button onClick={finish} disabled={finalizing} variant="accent" className="flex-1">
            {finalizing ? "Finalizing…" : "Confirm final"}
          </Button>
        </div>
      </div>
    );
  }

  /* --------------------------------- tracker --------------------------------- */
  const recentEvents = [...events]
    .filter((e) => !e.voided && !["period_start"].includes(e.type))
    .sort((a, b) => b.seq - a.seq)
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-2xl space-y-3 pb-40">
      {/* Score + clock header */}
      <section className="card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-center">
            <p className="text-xs font-bold" style={{ color: home.color }}>
              {home.name}
            </p>
            <p className="num text-4xl">{box.homeScore}</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-medium text-ink-faint">Period {period}</p>
            <button
              onClick={() => setRunning(!running)}
              className={`num min-h-11 rounded-control px-4 text-3xl ${
                running ? "bg-tint text-accent" : "bg-rule"
              }`}
              aria-label={running ? "Stop clock" : "Start clock"}
            >
              {mmss(clockMs)}
            </button>
            <div className="mt-1 flex justify-center gap-1">
              <button onClick={() => setClockMs((m) => Math.max(0, m - 60000))} className="min-h-8 rounded px-2 text-xs text-ink-faint">−1m</button>
              <button onClick={() => setClockMs((m) => m + 60000)} className="min-h-8 rounded px-2 text-xs text-ink-faint">+1m</button>
              <button onClick={endPeriod} className="min-h-8 rounded bg-rule px-2 text-xs font-semibold">
                End period
              </button>
            </div>
          </div>
          <div className="text-center">
            <p className="text-xs font-bold" style={{ color: away.color }}>
              {away.name}
            </p>
            <p className="num text-4xl">{box.awayScore}</p>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className={pendingCount > 0 ? "font-semibold text-accent" : "text-ink-faint"}>
            {pendingCount > 0 ? `● ${pendingCount} queued offline` : "● synced"}
          </span>
          <div className="flex gap-2">
            <button onClick={undoLast} className="min-h-8 rounded-control bg-rule px-3 text-xs font-bold">
              UNDO
            </button>
            <button onClick={() => record("timeout", {})} className="min-h-8 rounded-control bg-rule px-3 text-xs font-bold">
              TIMEOUT
            </button>
            <button onClick={() => setConfirmEnd(true)} className="min-h-8 rounded-control bg-accent px-3 text-xs font-bold text-white">
              END GAME
            </button>
          </div>
        </div>
      </section>

      {/* Assist prompt */}
      {assistPrompt ? (
        <section className="card border-2 border-accent p-3">
          <p className="mb-2 text-sm font-semibold">Assist on that bucket?</p>
          <div className="flex flex-wrap gap-1.5">
            {[...(onCourt[assistPrompt.teamId] ?? [])]
              .filter((u) => u !== assistPrompt.scorer)
              .map((u) => {
                const name =
                  [...home.roster, ...away.roster].find((r) => r.user_id === u)
                    ?.full_name ?? "—";
                return (
                  <button
                    key={u}
                    onClick={() => addAssist(u)}
                    className="min-h-11 rounded-control bg-rule px-3 text-sm font-semibold"
                  >
                    {name}
                  </button>
                );
              })}
            <button
              onClick={() => addAssist(null)}
              className="min-h-11 rounded-control px-3 text-sm font-medium text-ink-faint"
            >
              No assist
            </button>
          </div>
        </section>
      ) : null}

      {/* Sub prompt */}
      {subMode ? (
        <section className="card border-2 border-bench p-3">
          <p className="mb-2 text-sm font-semibold">Who&apos;s coming in?</p>
          <div className="flex flex-wrap gap-1.5">
            {(subMode.teamId === home.id ? home : away).roster
              .filter((r) => !(onCourt[subMode.teamId] ?? new Set()).has(r.user_id))
              .map((r) => (
                <button
                  key={r.user_id}
                  onClick={() => doSub(r.user_id)}
                  className="min-h-11 rounded-control bg-rule px-3 text-sm font-semibold"
                >
                  {r.full_name}
                </button>
              ))}
            <button
              onClick={() => setSubMode(null)}
              className="min-h-11 rounded-control px-3 text-sm font-medium text-ink-faint"
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {/* Rosters: on-court big buttons */}
      <div className="grid grid-cols-2 gap-3">
        {[home, away].map((side) => (
          <section key={side.id} className="card overflow-hidden">
            <h3
              className="px-3 py-2 text-xs font-bold text-white"
              style={{ backgroundColor: side.color }}
            >
              {side.name}
            </h3>
            <div className="space-y-1.5 p-2.5">
              {side.roster
                .filter((r) => (onCourt[side.id] ?? new Set()).has(r.user_id))
                .map((r) => {
                  const line = box.players.get(r.user_id);
                  const isSel =
                    selected?.userId === r.user_id && selected.teamId === side.id;
                  return (
                    <button
                      key={r.user_id}
                      onClick={() =>
                        setSelected(isSel ? null : { teamId: side.id, userId: r.user_id })
                      }
                      className={`flex min-h-12 w-full items-center justify-between rounded-control px-3 text-left ${
                        isSel ? "bg-ink text-surface" : "bg-paper hover:bg-surface"
                      }`}
                    >
                      <span className="min-w-0 truncate text-sm font-bold">
                        {r.jersey_number != null ? `#${r.jersey_number} ` : ""}
                        {r.full_name}
                      </span>
                      <span className={`tabular text-xs ${isSel ? "text-surface/70" : "text-ink-faint"}`}>
                        {line?.pts ?? 0}p {line?.reb ?? 0}r
                      </span>
                    </button>
                  );
                })}
              <button
                onClick={() => {
                  const court = [...(onCourt[side.id] ?? [])];
                  if (court.length > 0)
                    setSubMode({ teamId: side.id, out: court[0] });
                }}
                className="w-full min-h-10 rounded-control border border-dashed border-ink/20 text-xs font-semibold text-ink-body"
              >
                SUB
              </button>
              {subMode?.teamId === side.id ? (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase text-ink-faint">
                    Out:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {[...(onCourt[side.id] ?? [])].map((u) => {
                      const name = side.roster.find((r) => r.user_id === u)?.full_name ?? "—";
                      return (
                        <button
                          key={u}
                          onClick={() => setSubMode({ teamId: side.id, out: u })}
                          className={`min-h-8 rounded px-2 text-xs font-semibold ${
                            subMode.out === u ? "bg-accent text-white" : "bg-rule"
                          }`}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        ))}
      </div>

      {/* Recent events */}
      <section className="card p-3">
        <ul className="space-y-1 text-xs text-ink-body">
          {recentEvents.map((e) => {
            const name =
              [...home.roster, ...away.roster].find((r) => r.user_id === e.user_id)
                ?.full_name ?? "";
            return (
              <li key={e.client_uuid} className="flex justify-between">
                <span>
                  {name} {EVENT_LABELS[e.type] ?? e.type}
                </span>
                <span className="tabular">{e.synced ? "✓" : "…"}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Event pad — fixed thumb zone */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-surface/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <p className="mb-2 text-center text-xs font-medium text-ink-body">
            {selected
              ? `Recording for ${
                  [...home.roster, ...away.roster].find((r) => r.user_id === selected.userId)?.full_name
                }`
              : "Tap a player, then an event"}
          </p>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
            {PLAYER_EVENTS.map((e) => (
              <button
                key={e.type}
                onClick={() => tapEvent(e.type)}
                disabled={!selected}
                className="min-h-12 rounded-control bg-ink text-xs font-bold text-surface disabled:opacity-30"
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
