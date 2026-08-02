"use client";

/**
 * <LiveConsole /> — the courtside scorekeeper's screen
 * (`/league/[slug]/game/[gameId]/live`), designed to be run one-handed on a
 * phone in a gym with bad Wi-Fi.
 *
 * Everything is event-sourced: each tap appends to a local event list that
 * is the single source of truth for score, fouls, timeouts, lineups, and
 * plus/minus (all derived by pure replay in @core). Events persist to
 * localStorage immediately and a background loop syncs them to Supabase,
 * keyed by client_uuid so retries are idempotent. Undo and log edits are
 * voids — nothing is ever destructively rewritten, so the whole history
 * stays reversible offline.
 *
 * `demo` renders the console against fixture data with no network at all —
 * used by the /design/live reference page.
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, TeamBadge } from "@/components/ui";
import { EVENT_LABELS } from "@core/game-constants";
import { periodLabel, type GameRules } from "@core/game-rules";
import {
  deriveOnCourt,
  formatClock,
  teamFoulsInPeriod,
  timeoutsUsed,
  withRunningScore,
} from "@core/live";
import { computeBoxScore, type GameEventInput } from "@core/stats";
import type { GameGuestRow, GameRow, LineupRow, RosterEntry } from "@core/types";
import {
  abandonGame,
  addGameGuest,
  finalizeGame,
  recordEvent,
  saveLineup,
  setGameState,
  updateGameSettings,
  voidEventByClientId,
  type TrackerEvent,
} from "@/app/(app)/league/[slug]/actions";

export interface TeamSide {
  id: string;
  name: string;
  abbrev: string;
  color: string;
  roster: RosterEntry[];
}

interface LocalEvent extends TrackerEvent {
  id?: string; // server id, known only for events loaded from the server
  synced: boolean;
  voided: boolean;
  /** false = a void that still needs to reach the server */
  voidSynced: boolean;
}

/** Free-text player added from the console. Ids are minted client-side so
    guests work fully offline; the sync loop lands them before any event
    that references them. */
interface LocalGuest {
  id: string;
  teamId: string;
  name: string;
  synced: boolean;
}

/* The 13 stat actions — two taps each: player chip, then one of these. */
const STAT_ACTIONS = [
  { type: "fg2_made", label: "2PT", sub: "made", key: "Q" },
  { type: "fg2_miss", label: "2PT", sub: "miss", key: "W" },
  { type: "fg3_made", label: "3PT", sub: "made", key: "E" },
  { type: "fg3_miss", label: "3PT", sub: "miss", key: "R" },
  { type: "ft_made", label: "FT", sub: "made", key: "T" },
  { type: "ft_miss", label: "FT", sub: "miss", key: "Y" },
  { type: "oreb", label: "OREB", sub: "", key: "O" },
  { type: "dreb", label: "DREB", sub: "", key: "D" },
  { type: "ast", label: "AST", sub: "", key: "A" },
  { type: "stl", label: "STL", sub: "", key: "S" },
  { type: "blk", label: "BLK", sub: "", key: "B" },
  { type: "to", label: "TO", sub: "", key: "X" },
  { type: "pf", label: "FOUL", sub: "", key: "F" },
] as const;

const STAT_VALUE: Record<string, number> = { fg2_made: 2, fg3_made: 3, ft_made: 1 };

const OTHER_KEYS = [
  ["1 – 5", "Select home player"],
  ["6 – 0", "Select away player"],
  ["Space", "Start / stop clock"],
  ["U", "Undo last event"],
  ["N", "End period"],
  ["Esc", "Clear selection / close"],
  ["?", "This overlay"],
] as const;

function snapshotKey(gameId: string) {
  return `live:${gameId}`;
}

interface Snapshot {
  events: LocalEvent[];
  guests?: LocalGuest[];
  period: number;
  clockMs: number;
}

function loadSnapshot(gameId: string): Snapshot | null {
  try {
    const raw = localStorage.getItem(snapshotKey(gameId));
    return raw ? (JSON.parse(raw) as Snapshot) : null;
  } catch {
    return null;
  }
}

/* ------------------------------ tiny primitives ----------------------------- */

function BarPill({
  onClick,
  disabled,
  accent,
  children,
  ariaLabel,
}: {
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`min-h-11 rounded-full px-3.5 text-[13px] font-semibold whitespace-nowrap disabled:opacity-35 sm:px-4 ${
        accent ? "bg-accent text-white" : "bg-rule text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/** Floating overlay — the one place shadow is allowed. */
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose?: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="card card-float scroll-contain max-h-[85dvh] w-full max-w-lg overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[19px] font-semibold leading-snug">{title}</h2>
          {onClose ? (
            <button
              onClick={onClose}
              aria-label="Close"
              className="grid size-11 shrink-0 place-items-center rounded-full bg-rule text-[15px] font-semibold"
            >
              ✕
            </button>
          ) : null}
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

/* --------------------------------- console --------------------------------- */

export function LiveConsole({
  slug,
  game,
  home,
  away,
  serverEvents,
  lineups,
  rules,
  serverGuests = [],
  demo = false,
}: {
  slug: string;
  game: GameRow;
  home: TeamSide;
  away: TeamSide;
  serverEvents: (TrackerEvent & { id: string; voided: boolean })[];
  lineups: LineupRow[];
  rules: GameRules;
  serverGuests?: GameGuestRow[];
  demo?: boolean;
}) {
  const router = useRouter();
  // Editable mid-game (settings sheet) — rules live outside the event
  // stream, so nothing recorded is ever touched by a change here.
  const [gameRules, setGameRules] = useState<GameRules>(rules);
  const [counts, setCounts] = useState(game.counts_for_standings);
  const periodMs = gameRules.periodMinutes * 60_000;

  /* ------------------------------- event store ------------------------------ */
  const [events, setEvents] = useState<LocalEvent[]>(() =>
    serverEvents.map((e) => ({ ...e, synced: true, voidSynced: true })),
  );
  const eventsRef = useRef(events);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  // Guests: free-text players added from the console, keyed like any other
  // player everywhere in the replay logic.
  const [guests, setGuests] = useState<LocalGuest[]>(() =>
    serverGuests.map((g) => ({
      id: g.id,
      teamId: g.team_id ?? "",
      name: g.display_name,
      synced: true,
    })),
  );
  const guestsRef = useRef(guests);
  useEffect(() => {
    guestsRef.current = guests;
  }, [guests]);

  const [status, setStatus] = useState(game.status);
  const [period, setPeriod] = useState(Math.max(1, game.period));
  const [clockMs, setClockMs] = useState(game.clock_ms ?? periodMs);
  const [running, setRunning] = useState(false);
  const [clockEpoch, setClockEpoch] = useState(0);
  const [selected, setSelected] = useState<{ teamId: string; userId: string } | null>(null);
  const [benchOpen, setBenchOpen] = useState<Record<string, boolean>>({});
  const [subPrompt, setSubPrompt] = useState<{
    teamId: string;
    inId?: string;
    outId?: string;
    blocking?: boolean;
  } | null>(null);
  const [assist, setAssist] = useState<{ teamId: string; scorer: string } | null>(null);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [abandoning, setAbandoning] = useState(false);
  const [editing, setEditing] = useState<LocalEvent | null>(null);
  const [reassigning, setReassigning] = useState(false);
  const [betweenPeriods, setBetweenPeriods] = useState<{ next: number; overtime?: boolean } | null>(null);
  const [confirmFinal, setConfirmFinal] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [netDown, setNetDown] = useState(false);
  const [starters, setStarters] = useState<Record<string, string[]>>(() => ({
    [home.id]: lineups.find((l) => l.team_id === home.id)?.on_court ?? [],
    [away.id]: lineups.find((l) => l.team_id === away.id)?.on_court ?? [],
  }));

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  /* --------------------------- offline persistence -------------------------- */
  // Rehydrate the queue after mount (localStorage is client-only). Deferred a
  // tick so hydration output stays stable.
  useEffect(() => {
    if (demo) return;
    const t = setTimeout(() => {
      const snap = loadSnapshot(game.id);
      if (!snap) return;
      const known = new Set(eventsRef.current.map((e) => e.client_uuid));
      const queued = snap.events.filter((q) => !known.has(q.client_uuid));
      if (queued.length > 0) setEvents((prev) => [...prev, ...queued]);
      const knownGuests = new Set(guestsRef.current.map((g) => g.id));
      const queuedGuests = (snap.guests ?? []).filter((g) => !knownGuests.has(g.id));
      if (queuedGuests.length > 0) setGuests((prev) => [...prev, ...queuedGuests]);
      if (game.status === "live" && snap.period >= Math.max(1, game.period)) {
        setPeriod(snap.period);
        setClockMs(snap.clockMs);
        setClockEpoch((n) => n + 1);
      }
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every change lands in localStorage first — the console must survive a
  // refresh with no network at all.
  useEffect(() => {
    if (demo) return;
    try {
      const snap: Snapshot = {
        events: events.filter((e) => !e.synced || !e.voidSynced),
        guests: guests.filter((g) => !g.synced),
        period,
        clockMs,
      };
      localStorage.setItem(snapshotKey(game.id), JSON.stringify(snap));
    } catch {
      // storage full/unavailable — the in-memory list still has everything
    }
  }, [events, guests, period, clockMs, game.id, demo]);

  /* -------------------------------- sync loop -------------------------------- */

  // Locally a player key is opaque (user or guest, computeBoxScore doesn't
  // care); the server payload has to split it back into the right column.
  const toPayload = useCallback((e: LocalEvent): TrackerEvent => {
    const isGuest = (id: string | null) =>
      id !== null && guestsRef.current.some((g) => g.id === id);
    return {
      seq: e.seq, period: e.period, clock_ms: e.clock_ms,
      team_id: e.team_id,
      user_id: isGuest(e.user_id) ? null : e.user_id,
      guest_id: isGuest(e.user_id) ? e.user_id : null,
      type: e.type, value: e.value,
      related_user_id: isGuest(e.related_user_id) ? null : e.related_user_id,
      related_guest_id: isGuest(e.related_user_id) ? e.related_user_id : null,
      client_uuid: e.client_uuid,
    };
  }, []);

  const syncing = useRef(false);
  const sync = useCallback(async () => {
    if (demo || syncing.current) return;
    syncing.current = true;
    let failed = false;
    try {
      // guests first — events referencing a guest FK onto their row
      const pendingGuests = guestsRef.current.filter((g) => !g.synced);
      for (const g of pendingGuests) {
        try {
          const res = await addGameGuest(game.id, {
            id: g.id,
            team_id: g.teamId,
            display_name: g.name,
          });
          if (res.error) { failed = true; break; }
          setGuests((prev) =>
            prev.map((p) => (p.id === g.id ? { ...p, synced: true } : p)),
          );
        } catch { failed = true; break; }
      }
      // inserts, oldest first — skip events voided before they ever synced
      const pending = failed
        ? []
        : eventsRef.current
            .filter((e) => !e.synced && !e.voided)
            .sort((a, b) => a.seq - b.seq);
      for (const e of pending) {
        try {
          const res = await recordEvent(game.id, toPayload(e));
          if (res.error) { failed = true; break; }
          setEvents((prev) =>
            prev.map((p) => (p.client_uuid === e.client_uuid ? { ...p, synced: true } : p)),
          );
        } catch { failed = true; break; }
      }
      // voids that happened while the insert was already on the server
      if (!failed) {
        const voids = eventsRef.current.filter((e) => e.synced && !e.voidSynced);
        for (const e of voids) {
          try {
            const res = await voidEventByClientId(game.id, e.client_uuid, e.voided);
            if (res.error) { failed = true; break; }
            setEvents((prev) =>
              prev.map((p) => (p.client_uuid === e.client_uuid ? { ...p, voidSynced: true } : p)),
            );
          } catch { failed = true; break; }
        }
      }
    } finally {
      syncing.current = false;
      setNetDown(failed);
    }
  }, [game.id, demo, toPayload]);

  useEffect(() => {
    if (demo) return;
    const t = setInterval(sync, 8000);
    const onUp = () => { setNetDown(false); sync(); };
    window.addEventListener("online", onUp);
    return () => { clearInterval(t); window.removeEventListener("online", onUp); };
  }, [sync, demo]);

  const pendingCount = useMemo(
    () => events.filter((e) => (!e.synced && !e.voided) || (e.synced && !e.voidSynced)).length,
    [events],
  );

  /* ---------------------------------- clock ---------------------------------- */
  const clockRef = useRef(clockMs);
  useEffect(() => {
    clockRef.current = clockMs;
  }, [clockMs]);
  useEffect(() => {
    if (!running) return;
    const anchor = Date.now();
    const base = clockRef.current;
    const t = setInterval(() => {
      const next = Math.max(0, base - (Date.now() - anchor));
      setClockMs(next);
      if (next <= 0) {
        setRunning(false);
        say("Clock at 0:00 — end the period when ready.");
      }
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, clockEpoch]);

  const adjustClock = (deltaMs: number) => {
    setClockMs((ms) => Math.max(0, ms + deltaMs));
    setClockEpoch((n) => n + 1);
  };

  /* ------------------------------ derived state ------------------------------ */
  const statInputs: GameEventInput[] = events.map((e) => ({
    seq: e.seq, type: e.type, team_id: e.team_id,
    user_id: e.user_id, related_user_id: e.related_user_id, voided: e.voided,
  }));
  const box = computeBoxScore(
    statInputs,
    [
      { seq: 0, team_id: home.id, on_court: starters[home.id] },
      { seq: 0, team_id: away.id, on_court: starters[away.id] },
    ],
    home.id,
    away.id,
  );
  const onCourt = deriveOnCourt(events, starters);
  const scoredLog = useMemo(
    () => withRunningScore(events, home.id).reverse(),
    [events, home.id],
  );
  const eventCount = useMemo(
    () => events.filter((e) => !e.voided && !["period_start", "period_end"].includes(e.type)).length,
    [events],
  );

  const guestEntries = useMemo(
    () =>
      guests.map(
        (g): RosterEntry & { teamId: string } => ({
          id: g.id,
          user_id: g.id,
          full_name: g.name,
          jersey_number: null,
          is_captain: false,
          is_guest: true,
          teamId: g.teamId,
        }),
      ),
    [guests],
  );

  const everyone = useMemo(() => {
    const m = new Map<string, RosterEntry & { teamId: string }>();
    for (const r of home.roster) m.set(r.user_id, { ...r, teamId: home.id });
    for (const r of away.roster) m.set(r.user_id, { ...r, teamId: away.id });
    for (const g of guestEntries) m.set(g.user_id, g);
    return m;
  }, [home, away, guestEntries]);

  const nameOf = useCallback(
    (userId: string | null | undefined) => {
      if (!userId) return "—";
      const r = everyone.get(userId);
      if (!r) return "—";
      return r.jersey_number != null ? `#${r.jersey_number} ${r.full_name}` : r.full_name;
    },
    [everyone],
  );

  const foulsOf = (userId: string) => box.players.get(userId)?.pf ?? 0;
  const fouledOut = (userId: string) => foulsOf(userId) >= gameRules.foulLimit;

  const sideOf = (teamId: string) => (teamId === home.id ? home : away);
  /** Rostered players plus any guests added for this game. */
  const rosterOf = (teamId: string) => [
    ...sideOf(teamId).roster,
    ...guestEntries.filter((g) => g.teamId === teamId),
  ];
  const courtList = (teamId: string) =>
    rosterOf(teamId)
      .filter((r) => onCourt[teamId]?.has(r.user_id))
      .sort((a, b) => (a.jersey_number ?? 99) - (b.jersey_number ?? 99));
  const benchList = (teamId: string) =>
    rosterOf(teamId)
      .filter((r) => !onCourt[teamId]?.has(r.user_id))
      .sort((a, b) => (a.jersey_number ?? 99) - (b.jersey_number ?? 99));

  const addGuest = (teamId: string, name: string) => {
    const trimmed = name.trim().slice(0, 60);
    if (!trimmed) return;
    const guest: LocalGuest = {
      id: crypto.randomUUID(),
      teamId,
      name: trimmed,
      synced: false,
    };
    setGuests((prev) => [...prev, guest]);
    // Pre-game, a player added by name is obviously meant to play — put
    // them straight into the starting five (tap to deselect still works),
    // instead of leaving the 0/5 counter sitting there.
    if (status === "scheduled") {
      setStarters((prev) => {
        const cur = prev[teamId] ?? [];
        return cur.length < 5 ? { ...prev, [teamId]: [...cur, guest.id] } : prev;
      });
    }
    if (!demo) {
      addGameGuest(game.id, { id: guest.id, team_id: teamId, display_name: trimmed })
        .then((res) => {
          if (!res.error) {
            setGuests((prev) =>
              prev.map((p) => (p.id === guest.id ? { ...p, synced: true } : p)),
            );
          }
        })
        .catch(() => setNetDown(true));
    }
    say(`${trimmed} added to ${sideOf(teamId).name}`);
  };

  const describe = useCallback(
    (e: { type: string; user_id: string | null; related_user_id: string | null; team_id: string | null }) => {
      if (e.type === "sub") {
        const inN = e.user_id ? nameOf(e.user_id) : null;
        const outN = e.related_user_id ? nameOf(e.related_user_id) : null;
        if (inN && outN) return `Sub — ${inN} in, ${outN} out`;
        if (outN) return `Sub — ${outN} out`;
        return "Substitution";
      }
      if (e.type === "timeout")
        return `Timeout — ${e.team_id ? sideOf(e.team_id).name : "game"}`;
      const who = e.user_id ? nameOf(e.user_id) : "";
      return `${who} ${EVENT_LABELS[e.type] ?? e.type}`.trim();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nameOf],
  );

  /* ------------------------------ event recording ----------------------------- */
  const nextSeq = () =>
    eventsRef.current.reduce((max, e) => Math.max(max, e.seq), 0) + 1;

  const record = useCallback(
    (
      type: string,
      opts: {
        teamId?: string | null; userId?: string | null;
        related?: string | null; value?: number | null;
        period?: number; clockMs?: number | null; seq?: number;
      } = {},
    ): LocalEvent => {
      const evt: LocalEvent = {
        seq: opts.seq ?? nextSeq(),
        period: opts.period ?? period,
        clock_ms: opts.clockMs !== undefined ? opts.clockMs : clockMs,
        team_id: opts.teamId ?? null,
        user_id: opts.userId ?? null,
        type,
        value: opts.value ?? null,
        related_user_id: opts.related ?? null,
        client_uuid: crypto.randomUUID(),
        synced: false,
        voided: false,
        voidSynced: true, // nothing to void yet
      };
      setEvents((prev) => [...prev, evt]);
      if (!demo) {
        // fire-and-forget; the sync loop covers failures and duplicates
        recordEvent(game.id, toPayload(evt))
          .then((res) => {
            if (!res.error) {
              setNetDown(false);
              setEvents((prev) =>
                prev.map((p) =>
                  p.client_uuid === evt.client_uuid ? { ...p, synced: true } : p,
                ),
              );
            }
          })
          .catch(() => setNetDown(true));
      }
      return evt;
    },
    [period, clockMs, game.id, demo, toPayload],
  );

  /** Void an event wherever it lives (queued locally or already on the server). */
  const voidLocal = useCallback(
    (clientUuid: string, voided = true) => {
      setEvents((prev) =>
        prev.map((p) => {
          if (p.client_uuid !== clientUuid) return p;
          // if it never reached the server, the void needs no propagation
          return { ...p, voided, voidSynced: !p.synced ? true : false };
        }),
      );
      const target = eventsRef.current.find((e) => e.client_uuid === clientUuid);
      if (!demo && target?.synced) {
        voidEventByClientId(game.id, clientUuid, voided)
          .then((res) => {
            if (!res.error) {
              setEvents((prev) =>
                prev.map((p) =>
                  p.client_uuid === clientUuid ? { ...p, voidSynced: true } : p,
                ),
              );
            }
          })
          .catch(() => setNetDown(true));
      }
    },
    [game.id, demo],
  );

  /* --------------------------------- actions --------------------------------- */
  const tapStat = useCallback(
    (type: string) => {
      if (!selected || status !== "live") return;
      const { teamId, userId } = selected;
      record(type, { teamId, userId, value: STAT_VALUE[type] ?? null });
      setSelected(null);
      if (type === "fg2_made" || type === "fg3_made") {
        setAssist({ teamId, scorer: userId });
      } else {
        setAssist(null);
      }
      if (type === "pf" || type === "tf") {
        const now = foulsOf(userId) + 1; // box hasn't re-derived yet this tick
        if (now >= gameRules.foulLimit) {
          setSubPrompt({ teamId, outId: userId, blocking: true });
          setAssist(null);
        } else if (now === gameRules.foulLimit - 1) {
          say(`${nameOf(userId)} has ${now} fouls — one from fouling out.`);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, status, record, gameRules.foulLimit, nameOf, say],
  );

  const addAssist = (userId: string | null) => {
    if (assist && userId) {
      record("ast", { teamId: assist.teamId, userId, related: assist.scorer });
    }
    setAssist(null);
  };

  const undo = useCallback(() => {
    const last = [...eventsRef.current]
      .filter((e) => !e.voided && !["period_start", "period_end"].includes(e.type))
      .sort((a, b) => b.seq - a.seq)[0];
    if (!last) return;
    voidLocal(last.client_uuid);
    say(`Undone — ${describe(last)}`);
  }, [voidLocal, describe, say]);

  const doSub = (teamId: string, inId: string | null, outId: string) => {
    record("sub", { teamId, userId: inId, related: outId });
    setSubPrompt(null);
    setSelected(null);
    say(
      inId
        ? `Sub — ${nameOf(inId)} in for ${nameOf(outId)}`
        : `${nameOf(outId)} out — playing short-handed`,
    );
  };

  const takeTimeout = (teamId: string) => {
    const left = gameRules.timeoutsPerTeam - timeoutsUsed(events, teamId);
    if (left <= 0) return;
    record("timeout", { teamId });
    say(`Timeout — ${sideOf(teamId).name} (${left - 1} left)`);
  };

  const pushGameState = useCallback(
    (state: Parameters<typeof setGameState>[1]) => {
      if (demo) return;
      setGameState(game.id, state).catch(() => setNetDown(true));
    },
    [game.id, demo],
  );

  const endPeriod = () => {
    if (status !== "live" || betweenPeriods || confirmFinal) return;
    setRunning(false);
    record("period_end", {});
    const tied = box.homeScore === box.awayScore;
    if (period >= gameRules.periods && !tied) {
      setConfirmFinal(true);
    } else {
      setBetweenPeriods({ next: period + 1, overtime: period >= gameRules.periods });
    }
  };

  const startPeriod = (next: number) => {
    const ms = (next > gameRules.periods ? gameRules.overtimeMinutes : gameRules.periodMinutes) * 60_000;
    setPeriod(next);
    setClockMs(ms);
    setClockEpoch((n) => n + 1);
    record("period_start", { period: next, clockMs: ms });
    setBetweenPeriods(null);
    pushGameState({ period: next, clock_ms: ms });
  };

  const tipOff = async () => {
    if (!demo) {
      for (const side of [home, away]) {
        await saveLineup(game.id, side.id, starters[side.id], 0).catch(() => null);
      }
    }
    setStatus("live");
    setPeriod(1);
    setClockMs(periodMs);
    setClockEpoch((n) => n + 1);
    record("period_start", { period: 1, clockMs: periodMs });
    setRunning(true);
    pushGameState({ status: "live", period: 1, clock_ms: periodMs });
  };

  const finish = async () => {
    if (demo) { say("Demo console — finalizing is disabled here."); return; }
    setFinalizing(true);
    setFinalizeError(null);
    await sync();
    const stillPending =
      eventsRef.current.some(
        (e) => (!e.synced && !e.voided) || (e.synced && !e.voidSynced),
      ) || guestsRef.current.some((g) => !g.synced);
    if (stillPending) {
      setFinalizing(false);
      setFinalizeError(
        "Some events haven't reached the server. Get back online, then confirm again.",
      );
      return;
    }
    const res = await finalizeGame(game.id, slug).catch(() => ({ error: "Network failed — try again." }));
    setFinalizing(false);
    if (res.error) { setFinalizeError(res.error); return; }
    try { localStorage.removeItem(snapshotKey(game.id)); } catch { /* fine */ }
    router.push(`/league/${slug}/game/${game.id}`);
  };

  // Mirror score/clock onto the games row every few seconds so dashboards and
  // the game page read live without replaying events themselves.
  const mirror = useRef({ home: -1, away: -1, period: -1 });
  useEffect(() => {
    if (demo || status !== "live") return;
    const t = setInterval(() => {
      const m = mirror.current;
      if (m.home === box.homeScore && m.away === box.awayScore && m.period === period) return;
      mirror.current = { home: box.homeScore, away: box.awayScore, period };
      pushGameState({
        home_score: box.homeScore,
        away_score: box.awayScore,
        period,
        clock_ms: clockRef.current,
      });
    }, 6000);
    return () => clearInterval(t);
  }, [demo, status, box.homeScore, box.awayScore, period, pushGameState]);

  /* ----------------------------- keyboard layer ------------------------------ */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "?") { setHelpOpen((v) => !v); return; }
      if (e.key === "Escape") {
        setHelpOpen(false); setSelected(null); setEditing(null);
        setAddingFor(null); setSettingsOpen(false); setConfirmAbandon(false);
        setReassigning(false); setAssist(null);
        if (!subPrompt?.blocking) setSubPrompt(null);
        return;
      }
      // everything below acts on the live game with no modal in the way
      if (
        helpOpen || subPrompt || editing || betweenPeriods ||
        confirmFinal || addingFor || settingsOpen
      )
        return;
      if (status !== "live") return;

      if (e.key === " ") { e.preventDefault(); setRunning((r) => !r); return; }
      const k = e.key.toUpperCase();
      if (k === "U") { undo(); return; }
      if (k === "N") { endPeriod(); return; }

      if (/^[0-9]$/.test(e.key)) {
        const n = parseInt(e.key, 10);
        const side = n >= 1 && n <= 5 ? home : away;
        const idx = n >= 1 && n <= 5 ? n - 1 : n === 0 ? 4 : n - 6;
        const player = courtList(side.id)[idx];
        if (player) {
          setSelected((cur) =>
            cur?.userId === player.user_id ? null : { teamId: side.id, userId: player.user_id },
          );
        }
        return;
      }
      const action = STAT_ACTIONS.find((a) => a.key === k);
      if (action) tapStat(action.type);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* --------------------- add player / settings / abandon --------------------- */

  const addPlayerModal = addingFor ? (
    <Modal
      title={`Add a player to ${sideOf(addingFor).name}`}
      onClose={() => setAddingFor(null)}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem(
            "guest_name",
          ) as HTMLInputElement;
          addGuest(addingFor, input.value);
          setAddingFor(null);
        }}
        className="space-y-3"
      >
        <input
          name="guest_name"
          autoFocus
          required
          maxLength={60}
          placeholder="Jordan from period 5"
          aria-label="Player name"
          className="w-full min-h-11 rounded-control border border-rule bg-paper px-4 text-[17px] text-ink placeholder:text-ink-faint focus:border-ink/40 focus:outline-none"
        />
        <p className="text-[13px] leading-relaxed text-ink-body">
          Just a name — for pickup players and visitors who aren&apos;t in the
          league. Their stats stay with this game.
        </p>
        <Button type="submit" variant="primary" className="w-full">
          Add player
        </Button>
      </form>
    </Modal>
  ) : null;

  const doAbandon = async () => {
    if (demo) {
      say("Demo console — abandoning is disabled here.");
      return;
    }
    setAbandoning(true);
    await sync();
    const stillPending =
      eventsRef.current.some(
        (e) => (!e.synced && !e.voided) || (e.synced && !e.voidSynced),
      ) || guestsRef.current.some((g) => !g.synced);
    if (stillPending) {
      setAbandoning(false);
      say("Some events haven't reached the server — get back online first.");
      return;
    }
    const res = await abandonGame(game.id, slug).catch(() => ({
      error: "Network failed — try again.",
    }));
    setAbandoning(false);
    if (res.error) {
      say(res.error);
      return;
    }
    try {
      localStorage.removeItem(snapshotKey(game.id));
    } catch {
      // storage unavailable — nothing to clean
    }
    router.push(`/league/${slug}/game/${game.id}`);
  };

  const settingsModal = settingsOpen ? (
    <Modal
      title="Game settings"
      onClose={() => {
        setSettingsOpen(false);
        setConfirmAbandon(false);
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const int = (key: string, fallback: number, min: number, max: number) => {
            const n = parseInt(String(f.get(key) ?? ""), 10);
            return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
          };
          const next: GameRules = {
            ...gameRules,
            periods: int("periods", gameRules.periods, 1, 8),
            periodMinutes: int("period_minutes", gameRules.periodMinutes, 1, 60),
            foulLimit: int("foul_limit", gameRules.foulLimit, 1, 10),
          };
          const nextCounts = f.get("counts") === "on";
          setGameRules(next);
          setCounts(nextCounts);
          if (!demo) {
            updateGameSettings(game.id, {
              rules_override: {
                periods: next.periods,
                period_minutes: next.periodMinutes,
                foul_limit: next.foulLimit,
              },
              counts_for_standings: nextCounts,
            }).catch(() => setNetDown(true));
          }
          setSettingsOpen(false);
          say("Settings updated — recorded events untouched.");
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ["periods", "Periods", gameRules.periods],
              ["period_minutes", "Minutes", gameRules.periodMinutes],
              ["foul_limit", "Foul limit", gameRules.foulLimit],
            ] as const
          ).map(([name, label, value]) => (
            <label key={name} className="block">
              <span className="label block !text-[11px]">{label}</span>
              <input
                name={name}
                type="number"
                min={1}
                defaultValue={value}
                className="tabular mt-1.5 w-full min-h-11 rounded-control border border-rule bg-paper px-3 text-[17px]"
              />
            </label>
          ))}
        </div>
        <label className="flex min-h-11 items-center gap-3 rounded-panel bg-paper px-4 py-3">
          <input
            type="checkbox"
            name="counts"
            defaultChecked={counts}
            className="size-5 accent-ink"
          />
          <span className="text-sm font-semibold">Counts toward standings</span>
        </label>
        <Button type="submit" variant="primary" className="w-full">
          Save settings
        </Button>
      </form>
      <div className="mt-5 border-t border-rule pt-4">
        {confirmAbandon ? (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-ink-body">
              The game ends here: the partial box score is kept and marked
              incomplete, and it never counts toward standings.
            </p>
            <div className="flex gap-2">
              <Button
                variant="quiet"
                className="flex-1"
                onClick={() => setConfirmAbandon(false)}
              >
                Keep playing
              </Button>
              <Button
                variant="accent"
                className="flex-1"
                disabled={abandoning}
                onClick={doAbandon}
              >
                {abandoning ? "Abandoning…" : "Abandon game"}
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmAbandon(true)}
            className="min-h-11 w-full rounded-control text-sm font-semibold text-accent hover:bg-tint"
          >
            Abandon this game…
          </button>
        )}
      </div>
    </Modal>
  ) : null;

  /* ----------------------------- pre-game screen ----------------------------- */
  if (status === "scheduled") {
    const toggleStarter = (teamId: string, userId: string) => {
      setStarters((prev) => {
        const cur = prev[teamId] ?? [];
        const next = cur.includes(userId)
          ? cur.filter((u) => u !== userId)
          : cur.length < 5
            ? [...cur, userId]
            : cur;
        return { ...prev, [teamId]: next };
      });
    };
    const ready =
      (starters[home.id]?.length ?? 0) > 0 && (starters[away.id]?.length ?? 0) > 0;
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <div>
          <p className="label !text-white/80">Live console</p>
          <h2 className="mt-1 text-[26px] font-semibold tracking-tight text-white">
            Pick starting fives.
          </h2>
          <p className="mt-1.5 text-[15px] font-medium text-white/85">
            Tap up to five players per team to put them on the floor.
          </p>
        </div>
        {[home, away].map((side) => (
          <section key={side.id} className="card overflow-hidden">
            <div className="flex items-center gap-2.5 border-b border-rule px-4 py-3">
              <TeamBadge abbrev={side.abbrev} color={side.color} />
              <span className="text-[15px] font-semibold">{side.name}</span>
              <span className="num ml-auto text-[13px] text-ink-muted">
                {starters[side.id]?.length ?? 0}/5
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 p-3">
              {rosterOf(side.id).map((m) => {
                const on = starters[side.id]?.includes(m.user_id);
                return (
                  <button
                    key={m.user_id}
                    onClick={() => toggleStarter(side.id, m.user_id)}
                    className={`min-h-11 rounded-control px-3 text-left text-sm font-semibold ${
                      on ? "bg-ink text-surface" : "bg-rule text-ink-body"
                    }`}
                  >
                    {m.jersey_number != null ? `#${m.jersey_number} ` : ""}
                    {m.full_name}
                  </button>
                );
              })}
              <button
                onClick={() => setAddingFor(side.id)}
                className="min-h-11 rounded-control border border-dashed border-ink/25 px-3 text-left text-sm font-semibold text-ink-body"
              >
                Add a player by name
              </button>
            </div>
          </section>
        ))}
        <Button onClick={tipOff} disabled={!ready} variant="accent" className="w-full">
          Tip off
        </Button>
        {addingFor ? addPlayerModal : null}
      </div>
    );
  }

  /* ------------------------------ finalize screen ----------------------------- */
  if (confirmFinal) {
    const lines = [...box.players.entries()].sort((a, b) => b[1].pts - a[1].pts);
    return (
      <div className="mx-auto max-w-lg space-y-3">
        <section className="card p-5 text-center">
          <p className="label">Confirm final</p>
          <div className="mt-3 flex items-center justify-center gap-4">
            <TeamBadge abbrev={home.abbrev} color={home.color} size={34} />
            <p className="num text-[44px] leading-none">
              {box.homeScore}–{box.awayScore}
            </p>
            <TeamBadge abbrev={away.abbrev} color={away.color} size={34} />
          </div>
          <p className="mt-2 text-sm text-ink-body">
            {home.name} vs {away.name} · {periodLabel(period, gameRules.periods)}
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
            Finalizing locks the box score, posts the result to the league feed,
            and updates standings, season totals, and leaderboards.
          </p>
        </section>
        <section className="card scroll-contain max-h-80 overflow-y-auto p-4">
          {lines.map(([userId, l]) => (
            <p
              key={userId}
              className="flex justify-between gap-3 border-t border-rule py-2 text-sm first:border-0"
            >
              <span className="min-w-0 truncate font-semibold">{nameOf(userId)}</span>
              <span className="num shrink-0 text-[13px] text-ink-body">
                {l.pts}p {l.reb}r {l.ast}a · {l.plus_minus > 0 ? `+${l.plus_minus}` : l.plus_minus}
              </span>
            </p>
          ))}
        </section>
        {finalizeError ? (
          <p role="alert" className="rounded-row bg-tint px-4 py-3 text-[15px] font-medium text-accent">
            {finalizeError}
          </p>
        ) : null}
        {pendingCount > 0 ? (
          <p className="rounded-row bg-paper px-4 py-3 text-[13px] text-ink-body">
            <span className="num">{pendingCount}</span> events still syncing — they
            must land before the final counts.
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button
            onClick={() => { setConfirmFinal(false); setFinalizeError(null); }}
            variant="quiet"
            className="flex-1"
          >
            Back to the game
          </Button>
          <Button onClick={finish} disabled={finalizing} variant="accent" className="flex-1">
            {finalizing ? "Finalizing…" : "Confirm final"}
          </Button>
        </div>
      </div>
    );
  }

  /* -------------------------------- live layout ------------------------------- */
  const bonus = {
    [home.id]: teamFoulsInPeriod(events, away.id, period) >= gameRules.bonusThreshold,
    [away.id]: teamFoulsInPeriod(events, home.id, period) >= gameRules.bonusThreshold,
  };

  const teamHeader = (side: TeamSide) => {
    const fouls = teamFoulsInPeriod(events, side.id, period);
    const toLeft = Math.max(0, gameRules.timeoutsPerTeam - timeoutsUsed(events, side.id));
    return (
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-center gap-2">
          <TeamBadge abbrev={side.abbrev} color={side.color} size={26} />
          <p className="hidden truncate text-[14px] font-semibold sm:block">{side.name}</p>
        </div>
        <p className="num mt-1.5 text-center text-[46px] leading-none sm:text-[54px]">
          {side.id === home.id ? box.homeScore : box.awayScore}
        </p>
        <div className="label mt-2 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 !text-[11px]">
          <span>
            Fouls <span className="num">{fouls}</span>
          </span>
          {bonus[side.id] ? <span className="!text-accent">Bonus</span> : null}
          <span>
            <span aria-hidden className="!text-ink-faint">
              ·{" "}
            </span>
            TO <span className="num">{toLeft}</span>
          </span>
        </div>
        <div className="mt-2 flex justify-center">
          <button
            onClick={() => takeTimeout(side.id)}
            disabled={toLeft <= 0 || status !== "live"}
            className="min-h-11 rounded-full bg-rule px-4 text-[12px] font-semibold disabled:opacity-35"
          >
            Timeout
          </button>
        </div>
      </div>
    );
  };

  const playerChip = (side: TeamSide, r: RosterEntry) => {
    const line = box.players.get(r.user_id);
    const pf = line?.pf ?? 0;
    const isSel = selected?.userId === r.user_id;
    const out = fouledOut(r.user_id);
    return (
      <button
        key={r.user_id}
        onClick={() =>
          setSelected(isSel ? null : { teamId: side.id, userId: r.user_id })
        }
        aria-pressed={isSel}
        aria-label={`${nameOf(r.user_id)} — ${line?.pts ?? 0} points, ${pf} fouls`}
        className={`flex min-h-12 w-full items-center justify-between gap-2 rounded-control px-3 text-left ${
          isSel ? "bg-ink text-surface" : out ? "bg-tint" : "bg-paper hover:bg-surface"
        }`}
      >
        <span className="min-w-0 truncate text-sm font-semibold">
          {r.jersey_number != null ? (
            <span className={`num mr-1.5 text-[13px] ${isSel ? "text-surface/70" : "text-ink-faint"}`}>
              {r.jersey_number}
            </span>
          ) : null}
          {r.full_name}
        </span>
        <span className={`num shrink-0 text-[12px] ${isSel ? "text-surface/70" : "text-ink-faint"}`}>
          {line?.pts ?? 0}p{" "}
          <span className={pf >= gameRules.foulLimit - 1 && !isSel ? "text-accent" : ""}>{pf}f</span>
        </span>
      </button>
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-3 pb-72 sm:pb-64">
      {/* ------------------------------ scoreboard ------------------------------ */}
      <section className="card p-4">
        <div className="flex items-start justify-between gap-2">
          {teamHeader(home)}
          <div className="shrink-0 text-center">
            <p className="label !text-[11px]">{periodLabel(period, gameRules.periods)}</p>
            <button
              onClick={() => status === "live" && setRunning((r) => !r)}
              aria-label={running ? "Stop the clock" : "Start the clock"}
              className={`num mt-1 min-h-11 rounded-control px-4 text-[34px] leading-tight sm:text-[40px] ${
                running ? "bg-tint text-accent" : "bg-rule"
              }`}
            >
              {formatClock(clockMs)}
            </button>
            <div className="mt-1.5 flex justify-center gap-1">
              {[
                ["−1m", -60_000], ["−10s", -10_000],
                ["+10s", 10_000], ["+1m", 60_000],
              ].map(([lab, d]) => (
                <button
                  key={lab as string}
                  onClick={() => adjustClock(d as number)}
                  className="num min-h-11 rounded-full px-2 text-[12px] text-ink-muted hover:bg-rule sm:px-2.5"
                >
                  {lab}
                </button>
              ))}
            </div>
            <div className="mt-1 flex items-center justify-center gap-3">
              <button
                onClick={() => setSettingsOpen(true)}
                className="label !text-[10px] !text-ink-faint hover:!text-ink"
              >
                Settings
              </button>
              <button
                onClick={() => setHelpOpen(true)}
                className="label hidden !text-[10px] !text-ink-faint hover:!text-ink lg:inline-block"
              >
                Keys — press ?
              </button>
            </div>
          </div>
          {teamHeader(away)}
        </div>
      </section>

      {/* ---------------------------- assist follow-up --------------------------- */}
      {assist ? (
        <section className="card p-3">
          <p className="mb-2 text-sm font-semibold">
            Assist on that bucket?
          </p>
          <div className="flex flex-wrap gap-1.5">
            {courtList(assist.teamId)
              .filter((r) => r.user_id !== assist.scorer)
              .map((r) => (
                <button
                  key={r.user_id}
                  onClick={() => addAssist(r.user_id)}
                  className="min-h-11 rounded-control bg-rule px-3 text-sm font-semibold"
                >
                  {nameOf(r.user_id)}
                </button>
              ))}
            <button
              onClick={() => addAssist(null)}
              className="min-h-11 rounded-control px-3 text-sm font-medium text-ink-faint"
            >
              No assist
            </button>
          </div>
        </section>
      ) : null}

      {/* -------------------------------- lineups -------------------------------- */}
      <div className="grid gap-3 sm:grid-cols-2">
        {[home, away].map((side) => {
          const bench = benchList(side.id);
          return (
            <section key={side.id} className="card overflow-hidden">
              <div className="flex items-center gap-2 border-b border-rule px-3 py-2">
                <TeamBadge abbrev={side.abbrev} color={side.color} size={22} />
                <span className="truncate text-[13px] font-semibold">{side.name}</span>
                <span className="label ml-auto !text-[10px]">On court</span>
              </div>
              <div className="space-y-1.5 p-2.5">
                {courtList(side.id).map((r) => playerChip(side, r))}
                <button
                  onClick={() =>
                    setBenchOpen((prev) => ({ ...prev, [side.id]: !prev[side.id] }))
                  }
                  aria-expanded={Boolean(benchOpen[side.id])}
                  className="flex min-h-11 w-full items-center justify-between rounded-control border border-dashed border-ink/25 px-3 text-[13px] font-semibold text-ink-body"
                >
                  Bench ({bench.length})
                  <span aria-hidden className="text-ink-faint">
                    {benchOpen[side.id] ? "−" : "+"}
                  </span>
                </button>
                {benchOpen[side.id] ? (
                  <>
                    {bench.map((r) => {
                      const out = fouledOut(r.user_id);
                      return (
                        <button
                          key={r.user_id}
                          onClick={() =>
                            !out && setSubPrompt({ teamId: side.id, inId: r.user_id })
                          }
                          disabled={out}
                          aria-label={`${nameOf(r.user_id)} — ${out ? "fouled out" : "sub in"}`}
                          className="flex min-h-11 w-full items-center justify-between rounded-control bg-rule/60 px-3 text-left text-sm font-medium disabled:opacity-45"
                        >
                          <span className="min-w-0 truncate">
                            {r.jersey_number != null ? (
                              <span className="num mr-1.5 text-[13px] text-ink-faint">
                                {r.jersey_number}
                              </span>
                            ) : null}
                            {r.full_name}
                          </span>
                          <span className="label shrink-0 !text-[10px] !text-ink-faint">
                            {out ? "Fouled out" : "Sub in"}
                          </span>
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setAddingFor(side.id)}
                      className="flex min-h-11 w-full items-center rounded-control px-3 text-sm font-semibold text-ink-body hover:bg-rule/60"
                    >
                      Add a player by name
                    </button>
                  </>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      {/* ------------------------------- event log ------------------------------- */}
      <section className="card overflow-hidden">
        <div className="flex items-baseline justify-between border-b border-rule px-4 py-2.5">
          <h3 className="text-[15px] font-semibold">Play-by-play</h3>
          <span className="label !text-[10px]">Tap a row to fix it</span>
        </div>
        <div className="scroll-contain max-h-72 overflow-y-auto">
          {scoredLog.length === 0 ? (
            <p className="px-4 py-5 text-sm text-ink-muted">
              Nothing yet — tap a player, then a stat.
            </p>
          ) : (
            scoredLog.map(({ event: e, home: h, away: a }) =>
              e.type === "period_start" || e.type === "period_end" ? (
                <p
                  key={e.client_uuid}
                  className="label border-t border-rule bg-paper px-4 py-1.5 text-center !text-[10px] first:border-0"
                >
                  {periodLabel(e.period, gameRules.periods)}{" "}
                  {e.type === "period_start" ? "start" : "end"}
                </p>
              ) : (
                <button
                  key={e.client_uuid}
                  onClick={() => { setEditing(e); setReassigning(false); }}
                  className="flex min-h-11 w-full items-center gap-3 border-t border-rule px-4 py-2 text-left first:border-0 hover:bg-paper"
                >
                  <span className="num w-16 shrink-0 text-[12px] text-ink-faint">
                    {periodLabel(e.period, gameRules.periods)} {formatClock(e.clock_ms)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                    {describe(e)}
                  </span>
                  <span className="num shrink-0 text-[12px] text-ink-body">
                    {h}–{a}
                  </span>
                </button>
              ),
            )
          )}
        </div>
      </section>

      {/* --------------------- fixed thumb zone: pad + status -------------------- */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-surface/95 backdrop-blur">
        <div className="mx-auto max-w-5xl p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <p className="mb-2 truncate text-center text-[12px] font-medium text-ink-body">
            {selected
              ? `Recording for ${nameOf(selected.userId)}`
              : "Tap a player, then a stat"}
          </p>
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 lg:grid-cols-13">
            {STAT_ACTIONS.map((a) => (
              <button
                key={a.type}
                onClick={() => tapStat(a.type)}
                disabled={!selected || status !== "live"}
                className="flex min-h-12 flex-col items-center justify-center rounded-control bg-ink leading-none text-surface disabled:opacity-30"
              >
                <span className="num text-[11px] font-semibold sm:text-[12px]">
                  {a.label}
                </span>
                {a.sub ? (
                  <span className="mt-0.5 text-[9px] text-surface/60">{a.sub}</span>
                ) : (
                  <span className="mt-0.5 hidden text-[9px] text-surface/40 lg:block">
                    {a.key}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="label flex items-center gap-2 !text-[11px]">
              <span className={demo || (!netDown && pendingCount === 0) ? "" : "!text-accent"}>
                ●
              </span>
              {demo
                ? "Demo"
                : netDown
                  ? "Offline"
                  : pendingCount > 0
                    ? "Syncing"
                    : "Synced"}
              <span className="num !normal-case !tracking-normal text-ink-faint">
                {eventCount} events
              </span>
            </p>
            <div className="flex gap-1.5 sm:gap-2">
              <BarPill onClick={undo} ariaLabel="Undo last event">Undo</BarPill>
              <BarPill onClick={endPeriod} disabled={status !== "live"}>
                End {periodLabel(period, gameRules.periods)}
              </BarPill>
              <BarPill onClick={() => { setRunning(false); setConfirmFinal(true); }} accent>
                Finalize
              </BarPill>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------- toast --------------------------------- */}
      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-56 z-40 flex justify-center px-4 sm:bottom-48">
          <p className="card-float rounded-full bg-ink px-5 py-2.5 text-[14px] font-medium text-white">
            {toast}
          </p>
        </div>
      ) : null}

      {/* ------------------------------ substitution ------------------------------ */}
      {subPrompt ? (
        <Modal
          title={
            subPrompt.blocking
              ? `${nameOf(subPrompt.outId)} fouled out. Pick a substitute.`
              : subPrompt.inId
                ? `${nameOf(subPrompt.inId)} in — who's coming out?`
                : "Substitution"
          }
          onClose={subPrompt.blocking ? undefined : () => setSubPrompt(null)}
        >
          <div className="space-y-1.5">
            {subPrompt.inId
              ? // bench player chosen — pick who leaves the floor
                courtList(subPrompt.teamId).map((r) => (
                  <button
                    key={r.user_id}
                    onClick={() => doSub(subPrompt.teamId, subPrompt.inId!, r.user_id)}
                    className="flex min-h-12 w-full items-center rounded-control bg-paper px-3 text-left text-sm font-semibold hover:bg-rule"
                  >
                    {nameOf(r.user_id)}
                  </button>
                ))
              : // fouled-out flow — pick who comes in
                benchList(subPrompt.teamId)
                  .filter((r) => !fouledOut(r.user_id))
                  .map((r) => (
                    <button
                      key={r.user_id}
                      onClick={() => doSub(subPrompt.teamId, r.user_id, subPrompt.outId!)}
                      className="flex min-h-12 w-full items-center rounded-control bg-paper px-3 text-left text-sm font-semibold hover:bg-rule"
                    >
                      {nameOf(r.user_id)}
                    </button>
                  ))}
            {!subPrompt.inId &&
            benchList(subPrompt.teamId).filter((r) => !fouledOut(r.user_id)).length === 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-ink-body">
                  No eligible players left on the bench.
                </p>
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => doSub(subPrompt.teamId, null, subPrompt.outId!)}
                >
                  Play short-handed
                </Button>
              </div>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {/* ------------------------------- event editor ------------------------------ */}
      {editing ? (
        <Modal
          title={describe(editing)}
          onClose={() => { setEditing(null); setReassigning(false); }}
        >
          <p className="num text-[12px] text-ink-faint">
            {periodLabel(editing.period, gameRules.periods)} {formatClock(editing.clock_ms)}
          </p>
          {reassigning && editing.team_id ? (
            <div className="mt-3 space-y-1.5">
              <p className="label !text-[11px]">Credit it to</p>
              {rosterOf(editing.team_id)
                .filter((r) => r.user_id !== editing.user_id)
                .map((r) => (
                  <button
                    key={r.user_id}
                    onClick={() => {
                      // event-sourced correction: void the original, insert a
                      // copy at the same seq so the replay (and plus/minus)
                      // sees it at the same point in the game
                      voidLocal(editing.client_uuid);
                      record(editing.type, {
                        teamId: editing.team_id,
                        userId: r.user_id,
                        related: editing.related_user_id,
                        value: editing.value,
                        period: editing.period,
                        clockMs: editing.clock_ms,
                        seq: editing.seq,
                      });
                      setEditing(null);
                      setReassigning(false);
                      say(`Moved to ${nameOf(r.user_id)} — ${EVENT_LABELS[editing.type] ?? editing.type}`);
                    }}
                    className="flex min-h-12 w-full items-center rounded-control bg-paper px-3 text-left text-sm font-semibold hover:bg-rule"
                  >
                    {nameOf(r.user_id)}
                  </button>
                ))}
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-2">
              {editing.user_id && editing.type !== "sub" ? (
                <Button variant="primary" onClick={() => setReassigning(true)}>
                  Wrong player — reassign
                </Button>
              ) : null}
              <Button
                variant="quiet"
                className="!text-accent"
                onClick={() => {
                  voidLocal(editing.client_uuid);
                  say(`Deleted — ${describe(editing)}`);
                  setEditing(null);
                }}
              >
                Delete this event
              </Button>
            </div>
          )}
        </Modal>
      ) : null}

      {/* ------------------------- between-periods lineup check ------------------------- */}
      {betweenPeriods ? (
        <Modal
          title={
            betweenPeriods.overtime
              ? "Tied. Overtime?"
              : `Confirm lineups for ${periodLabel(betweenPeriods.next, gameRules.periods)}.`
          }
        >
          <p className="text-sm text-ink-body">
            Team fouls reset. Tap a bench name to swap someone in before the
            period starts.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[home, away].map((side) => (
              <div key={side.id} className="rounded-panel bg-paper p-3">
                <div className="mb-2 flex items-center gap-2">
                  <TeamBadge abbrev={side.abbrev} color={side.color} size={20} />
                  <span className="truncate text-[13px] font-semibold">{side.name}</span>
                </div>
                <div className="space-y-1">
                  {courtList(side.id).map((r) => (
                    <p key={r.user_id} className="truncate text-[13px] font-medium">
                      {nameOf(r.user_id)}
                    </p>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {benchList(side.id)
                    .filter((r) => !fouledOut(r.user_id))
                    .map((r) => (
                      <button
                        key={r.user_id}
                        onClick={() => setSubPrompt({ teamId: side.id, inId: r.user_id })}
                        className="min-h-11 rounded-full bg-rule px-3 text-[12px] font-semibold"
                      >
                        {r.jersey_number != null ? `#${r.jersey_number} ` : ""}
                        {r.full_name.split(" ")[0]}
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            {betweenPeriods.overtime ? (
              <Button variant="quiet" className="flex-1" onClick={() => { setBetweenPeriods(null); setConfirmFinal(true); }}>
                Finalize as tie
              </Button>
            ) : null}
            <Button variant="primary" className="flex-1" onClick={() => startPeriod(betweenPeriods.next)}>
              Start {periodLabel(betweenPeriods.next, gameRules.periods)}
            </Button>
          </div>
        </Modal>
      ) : null}

      {addPlayerModal}
      {settingsModal}

      {/* -------------------------------- shortcuts -------------------------------- */}
      {helpOpen ? (
        <Modal title="Keyboard shortcuts" onClose={() => setHelpOpen(false)}>
          <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {[
              ...STAT_ACTIONS.map((a) => [a.key, `${a.label}${a.sub ? ` ${a.sub}` : ""}`] as const),
              ...OTHER_KEYS,
            ].map(([k, what]) => (
              <p key={`${k}${what}`} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-ink-body">{what}</span>
                <span className="num rounded-[6px] bg-paper px-2 py-0.5 text-[12px]">{k}</span>
              </p>
            ))}
          </div>
        </Modal>
      ) : null}

      {/* Back link for scorekeepers who opened the wrong game */}
      <p className="pt-1 text-center">
        <Link
          href={`/league/${slug}/game/${game.id}`}
          className="label !text-white/70 hover:!text-white"
        >
          Game page
        </Link>
      </p>
    </div>
  );
}
