"use client";

import { useActionState, useState } from "react";
import { Avatar, Button, FormError, FormNotice, Select } from "@/components/ui";
import type { ConsentRow } from "@core/types";
import { grantConsent, revokeConsent, type ActionState } from "./actions";

const initial: ActionState = { error: null };

const SOURCE_LABEL: Record<string, string> = {
  league_join: "Joined the league",
  school_form: "School form",
  guardian_email: "Guardian email",
  athlete_signed: "Athlete signed",
};

export function ConsentPanel({
  slug,
  leagueId,
  members,
  consents,
}: {
  slug: string;
  leagueId: string;
  members: { user_id: string; full_name: string; grade: number | null }[];
  consents: ConsentRow[];
}) {
  const [state, formAction, pending] = useActionState(grantConsent, initial);
  const [open, setOpen] = useState(false);

  const byUser = new Map(consents.map((c) => [c.user_id, c]));
  // With consent recorded at join, the only people outside the gate are
  // players whose consent was revoked (or, rarely, never written).
  const revoked = members.filter((m) => byUser.get(m.user_id)?.revoked_at != null);
  const missing = members.filter((m) => !byUser.get(m.user_id));
  const blocked = [...revoked, ...missing];

  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Film consent</h2>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="min-h-11 text-sm font-medium text-ink-body underline underline-offset-4"
        >
          {open ? "Hide the roster" : "Show the roster"}
        </button>
      </div>
      <p className="mb-4 max-w-[62ch] text-sm text-ink-muted">
        Consent is part of joining the league — the signup form covers game
        film, so it is recorded automatically for every member. Revoking it
        here is real: one revoked player on either roster blocks that game&rsquo;s
        film from being processed, and their identity is never taken from
        video. Identity never comes from a face — only jersey, colour, and the
        roster.
      </p>

      {blocked.length > 0 ? (
        <p className="mb-4 rounded-row bg-tint px-4 py-3 text-[17px] font-medium text-accent">
          <span className="num">{blocked.length}</span> player
          {blocked.length === 1 ? "" : "s"}{" "}
          {blocked.length === 1 ? "blocks" : "block"} film processing:{" "}
          {blocked
            .slice(0, 6)
            .map((m) => m.full_name)
            .join(", ")}
          {blocked.length > 6 ? `, and ${blocked.length - 6} more` : ""}.
          Re-grant below once the school has new permission on file.
        </p>
      ) : members.length > 0 ? (
        <p className="mb-4 rounded-row bg-ink px-4 py-3 text-[17px] font-medium text-on-ink">
          Every player in the league is covered. Film can be processed.
        </p>
      ) : null}

      {blocked.length > 0 ? (
        <form action={formAction} className="mb-4 space-y-3">
          <FormError message={state.error} />
          <FormNotice message={state.notice} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="league_id" value={leagueId} />
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-[14rem] flex-1">
              <span className="label mb-1.5 block">Player</span>
              <Select name="user_id" required defaultValue="">
                <option value="">Pick a player…</option>
                {blocked.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.full_name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="min-w-[12rem]">
              <span className="label mb-1.5 block">How it was given</span>
              <Select name="source" defaultValue="school_form">
                {Object.entries(SOURCE_LABEL)
                  .filter(([value]) => value !== "league_join")
                  .map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
              </Select>
            </label>
            <Button type="submit" disabled={pending}>
              {pending ? "Recording…" : "Re-grant consent"}
            </Button>
          </div>
        </form>
      ) : null}

      {open ? (
        <ul className="space-y-1.5">
          {members.map((m) => {
            const consent = byUser.get(m.user_id);
            const active = consent?.revoked_at === null;
            return (
              <li
                key={m.user_id}
                className="row flex flex-wrap items-center gap-3 px-4 py-2.5"
              >
                <Avatar name={m.full_name} size={32} />
                <span className="min-w-0 flex-1 truncate text-[17px] font-medium">
                  {m.full_name}
                </span>
                <span
                  className={
                    active
                      ? "label rounded-full bg-ink px-2.5 py-1 !text-[11px] !text-on-ink"
                      : "label rounded-full bg-tint px-2.5 py-1 !text-[11px] !text-accent"
                  }
                >
                  {active
                    ? (SOURCE_LABEL[consent.source] ?? "on file")
                    : consent
                      ? "revoked"
                      : "not on file"}
                </span>
                {active ? (
                  <form action={revokeConsent}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="league_id" value={leagueId} />
                    <input type="hidden" name="user_id" value={m.user_id} />
                    <button className="min-h-11 rounded-full px-3 text-sm font-medium text-accent hover:bg-tint">
                      Revoke
                    </button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
