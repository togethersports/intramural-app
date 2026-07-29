"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { IconQueue } from "@/components/icons";
import { Avatar, Button, TeamBadge } from "@/components/ui";
import type { DraftPickRow, DraftRow, TeamWithRoster } from "@core/types";
import {
  autoPickAction,
  makePickAction,
  queueAdd,
  queueRemove,
  setDraftStatus,
  undoPickAction,
} from "../actions";

interface EligiblePlayer {
  user_id: string;
  full_name: string;
  grade: number | null;
}

function pickTeamFor(draft: DraftRow, pickNo: number): string | null {
  const n = draft.pick_order.length;
  if (n === 0) return null;
  const round = Math.floor((pickNo - 1) / n) + 1;
  let idx = (pickNo - 1) % n;
  if (draft.format === "snake" && round % 2 === 0) idx = n - 1 - idx;
  return draft.pick_order[idx] ?? null;
}

export function DraftRoom({
  slug,
  draft,
  picks,
  teams,
  eligible,
  queue,
  myTeamId,
  isAdmin,
}: {
  slug: string;
  draft: DraftRow;
  picks: DraftPickRow[];
  teams: TeamWithRoster[];
  eligible: EligiblePlayer[];
  queue: { id: string; user_id: string; rank: number; full_name: string }[];
  myTeamId: string | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const autoFiredFor = useRef<number>(0);

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const totalPicks = draft.rounds * draft.pick_order.length;
  const currentTeamId =
    draft.status === "complete" ? null : pickTeamFor(draft, draft.current_pick_no);
  const myTurn = currentTeamId !== null && currentTeamId === myTeamId;

  // ---- live updates: realtime subscription + poll fallback
  const refresh = useCallback(() => router.refresh(), [router]);
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`draft:${draft.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "draft_picks", filter: `draft_id=eq.${draft.id}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drafts", filter: `id=eq.${draft.id}` },
        refresh,
      )
      .subscribe();
    const poll =
      draft.status === "live" ? setInterval(refresh, 5000) : undefined;
    return () => {
      supabase.removeChannel(channel);
      if (poll) clearInterval(poll);
    };
  }, [draft.id, draft.status, refresh]);

  // ---- countdown
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const deadline = draft.last_pick_at
    ? new Date(draft.last_pick_at).getTime() + draft.pick_seconds * 1000
    : null;
  const secondsLeft =
    draft.status === "live" && deadline
      ? Math.max(0, Math.ceil((deadline - now) / 1000))
      : null;

  // clock hits zero → someone triggers the auto-pick (once per pick per client)
  useEffect(() => {
    if (
      draft.status === "live" &&
      secondsLeft === 0 &&
      autoFiredFor.current !== draft.current_pick_no
    ) {
      autoFiredFor.current = draft.current_pick_no;
      startTransition(async () => {
        await autoPickAction(draft.id, slug);
      });
    }
  }, [secondsLeft, draft.status, draft.current_pick_no, draft.id, slug]);

  const queuedIds = useMemo(() => new Set(queue.map((q) => q.user_id)), [queue]);
  const filtered = eligible.filter((p) =>
    p.full_name.toLowerCase().includes(search.toLowerCase()),
  );

  const draftPlayer = (userId: string) => {
    startTransition(async () => {
      await makePickAction(draft.id, userId, slug);
    });
  };

  const toggleQueue = (userId: string) => {
    startTransition(async () => {
      const existing = queue.find((q) => q.user_id === userId);
      if (existing) await queueRemove(existing.id, slug);
      else if (myTeamId)
        await queueAdd(draft.id, myTeamId, userId, queue.length + 1, slug);
    });
  };

  const ringPct = secondsLeft !== null ? secondsLeft / draft.pick_seconds : 0;

  return (
    <div className="space-y-5">
      {/* On-the-clock banner */}
      <section className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-4">
          {draft.status === "live" && secondsLeft !== null ? (
            <div className="relative grid size-16 place-items-center">
              <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
                <circle cx="20" cy="20" r="17" fill="none" stroke="var(--color-rule)" strokeWidth="4" />
                <circle
                  cx="20" cy="20" r="17" fill="none"
                  stroke={secondsLeft <= 10 ? "var(--color-accent)" : "var(--color-bench)"}
                  strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={`${ringPct * 106.8} 106.8`}
                />
              </svg>
              <span className="num text-[22px]">{secondsLeft}</span>
            </div>
          ) : null}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
              {draft.status === "complete"
                ? "Draft complete"
                : draft.status === "paused"
                  ? "Paused"
                  : draft.status === "setup"
                    ? "Waiting to start"
                    : `Pick ${draft.current_pick_no} of ${totalPicks}`}
            </p>
            {currentTeamId ? (
              <p className="text-xl font-semibold tracking-tight">
                {teamById.get(currentTeamId)?.name ?? "?"} on the clock
                {myTurn ? " — that's you!" : ""}
              </p>
            ) : (
              <p className="text-xl font-semibold tracking-tight">
                {draft.status === "complete" ? "All rosters set" : `${draft.format} · ${draft.rounds} rounds`}
              </p>
            )}
          </div>
        </div>
        {isAdmin ? (
          <div className="flex flex-wrap gap-2">
            {draft.status === "setup" || draft.status === "paused" ? (
              <form action={setDraftStatus}>
                <input type="hidden" name="draft_id" value={draft.id} />
                <input type="hidden" name="status" value="live" />
                <input type="hidden" name="slug" value={slug} />
                <Button type="submit" variant="accent">
                  {draft.status === "setup" ? "Start draft" : "Resume"}
                </Button>
              </form>
            ) : null}
            {draft.status === "live" ? (
              <form action={setDraftStatus}>
                <input type="hidden" name="draft_id" value={draft.id} />
                <input type="hidden" name="status" value="paused" />
                <input type="hidden" name="slug" value={slug} />
                <Button type="submit" variant="quiet">Pause</Button>
              </form>
            ) : null}
            {picks.length > 0 && draft.status !== "setup" ? (
              <form action={undoPickAction}>
                <input type="hidden" name="draft_id" value={draft.id} />
                <input type="hidden" name="slug" value={slug} />
                <Button type="submit" variant="quiet">Undo pick</Button>
              </form>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Available players */}
        <section className="card p-5 lg:col-span-1">
          <h3 className="mb-3 text-lg font-semibold tracking-tight">
            Available <span className="text-sm font-medium text-ink-faint">({eligible.length})</span>
          </h3>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search players…"
            className="mb-3 h-11 w-full rounded-control border border-rule bg-paper px-3 text-[17px] placeholder:text-ink-faint focus:border-ink/30 focus:outline-none"
          />
          <ul className="scroll-contain max-h-[60vh] space-y-1 overflow-y-auto sm:max-h-[26rem]">
            {filtered.map((p) => (
              <li
                key={p.user_id}
                className="flex items-center gap-2 rounded-panel px-2 py-1.5 hover:bg-paper"
              >
                <Avatar name={p.full_name} size={30} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {p.full_name}
                  {p.grade ? (
                    <span className="ml-1.5 text-xs text-ink-faint">gr {p.grade}</span>
                  ) : null}
                </span>
                {myTeamId ? (
                  <button
                    onClick={() => toggleQueue(p.user_id)}
                    disabled={pending}
                    aria-label={queuedIds.has(p.user_id) ? "Remove from queue" : "Add to queue"}
                    className={`grid size-11 place-items-center rounded-full ${
                      queuedIds.has(p.user_id)
                        ? "bg-accent text-white"
                        : "text-ink-faint hover:bg-rule hover:text-ink"
                    }`}
                  >
                    <IconQueue size={18} />
                  </button>
                ) : null}
                {(myTurn || (isAdmin && draft.status === "live")) && (
                  <button
                    onClick={() => draftPlayer(p.user_id)}
                    disabled={pending}
                    className="min-h-11 rounded-control bg-ink px-3 text-xs font-bold text-surface hover:bg-black disabled:opacity-50"
                  >
                    Draft
                  </button>
                )}
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="px-2 py-3 text-sm text-ink-faint">No players match.</li>
            ) : null}
          </ul>

          {myTeamId && queue.length > 0 ? (
            <div className="mt-4 border-t border-rule pt-3">
              <h4 className="mb-2 text-sm font-semibold text-ink-body">
                My queue (auto-picks in order)
              </h4>
              <ol className="space-y-1">
                {queue.map((q, i) => (
                  <li key={q.id} className="flex items-center gap-2 text-sm">
                    <span className="tabular w-5 text-right text-xs text-ink-faint">{i + 1}.</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{q.full_name}</span>
                    <button
                      onClick={() => startTransition(async () => { await queueRemove(q.id, slug); })}
                      className="min-h-11 px-2 text-xs font-semibold text-accent"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </section>

        {/* Rosters */}
        <section className="space-y-4 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            {teams.map((team) => (
              <div
                key={team.id}
                className={`card overflow-hidden ${
                  team.id === currentTeamId ? "ring-2 ring-accent" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2 border-b border-rule px-4 py-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <TeamBadge abbrev={team.abbrev} color={team.color} size={24} />
                    <span className="truncate text-[17px] font-semibold">
                      {team.name}
                    </span>
                  </span>
                  {team.id === currentTeamId ? (
                    <span className="label rounded-full bg-accent px-2.5 py-1 !text-[10px] !text-white">
                      On the clock
                    </span>
                  ) : (
                    <span className="label">{team.roster.length}</span>
                  )}
                </div>
                <ul className="px-4 py-2 text-sm">
                  {team.roster.map((m) => (
                    <li key={m.id} className="flex items-center gap-2 py-1">
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {m.full_name}
                      </span>
                      {m.is_captain ? (
                        <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">C</span>
                      ) : null}
                    </li>
                  ))}
                  {team.roster.length === 0 ? (
                    <li className="py-1 text-ink-faint">—</li>
                  ) : null}
                </ul>
              </div>
            ))}
          </div>

          {/* Pick ticker */}
          <div className="card p-5">
            <h3 className="mb-3 text-lg font-semibold tracking-tight">Pick log</h3>
            {picks.length === 0 ? (
              <p className="text-sm text-ink-faint">No picks yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {[...picks].reverse().slice(0, 12).map((p) => (
                  <li key={p.pick_no} className="flex items-center gap-3 text-sm">
                    <span className="tabular w-10 text-xs font-semibold text-ink-faint">
                      {p.round}.{String(((p.pick_no - 1) % draft.pick_order.length) + 1).padStart(2, "0")}
                    </span>
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: teamById.get(p.team_id)?.color ?? "#54749b" }}
                    />
                    <span className="min-w-0 flex-1 truncate font-semibold">{p.full_name}</span>
                    <span className="truncate text-xs text-ink-body">
                      {teamById.get(p.team_id)?.name ?? "?"}
                      {p.auto_picked ? " · auto" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
