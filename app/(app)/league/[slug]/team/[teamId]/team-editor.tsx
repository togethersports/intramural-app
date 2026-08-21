"use client";

import { useActionState, useRef, useState } from "react";
import { IconCamera } from "@/components/icons";
import {
  Avatar,
  Button,
  Field,
  FormError,
  FormNotice,
  Input,
  Panel,
  Select,
  TeamBadge,
} from "@/components/ui";
import { positionsFor } from "@core/league-constants";
import type { RosterEntry } from "@core/types";
import {
  updateLineup,
  updateTeamBadge,
  updateTeamCard,
  type ActionState,
} from "../../actions";

const EMPTY: ActionState = { error: null };

/** Name, abbreviation, colour and badge — the captain's own team card. */
export function TeamCardEditor({
  slug,
  leagueId,
  team,
}: {
  slug: string;
  leagueId: string;
  team: {
    id: string;
    name: string;
    abbrev: string;
    color: string;
    logo_url: string | null;
  };
}) {
  const [cardState, cardAction, cardPending] = useActionState(
    updateTeamCard,
    EMPTY,
  );
  const [badgeState, badgeAction, badgePending] = useActionState(
    updateTeamBadge,
    EMPTY,
  );
  const badgeRef = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const shown = preview ?? team.logo_url;

  return (
    <Panel eyebrow="Captain" title="Team card">
      <form ref={badgeRef} action={badgeAction} className="space-y-3">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="team_id" value={team.id} />
        <input type="hidden" name="league_id" value={leagueId} />
        <div className="flex flex-wrap items-center gap-4">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shown}
              alt=""
              className="size-16 shrink-0 rounded-[16px] object-cover"
            />
          ) : (
            <TeamBadge abbrev={team.abbrev} color={team.color} size={64} />
          )}
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-ink px-5 text-[15px] font-semibold text-on-ink transition-opacity hover:opacity-90">
            <IconCamera size={17} />
            {team.logo_url ? "Change badge" : "Add a badge"}
            <input
              type="file"
              name="badge"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setPreview(URL.createObjectURL(file));
                badgeRef.current?.requestSubmit();
              }}
            />
          </label>
          {team.logo_url ? (
            <Button
              type="submit"
              name="intent"
              value="remove"
              variant="quiet"
              className="!min-h-11 !px-4 !text-[15px]"
              onClick={() => setPreview(null)}
            >
              Remove
            </Button>
          ) : null}
        </div>
        {badgePending ? (
          <p className="text-[15px] text-ink-body">Uploading…</p>
        ) : (
          <>
            <FormError message={badgeState.error} />
            <FormNotice message={badgeState.notice} />
          </>
        )}
      </form>

      <form action={cardAction} className="mt-5 space-y-4 border-t border-rule pt-5">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="team_id" value={team.id} />
        <FormError message={cardState.error} />
        <FormNotice message={cardState.notice} />
        <div className="grid gap-4 sm:grid-cols-[1fr_7rem_7rem]">
          <Field label="Team name" htmlFor="tc-name">
            <Input
              id="tc-name"
              name="name"
              defaultValue={team.name}
              maxLength={40}
              required
            />
          </Field>
          <Field label="Short" htmlFor="tc-abbrev" hint="Three letters.">
            <Input
              id="tc-abbrev"
              name="abbrev"
              defaultValue={team.abbrev}
              maxLength={3}
              className="num uppercase"
            />
          </Field>
          <Field label="Colour" htmlFor="tc-color">
            <Input
              id="tc-color"
              name="color"
              type="color"
              defaultValue={team.color}
              className="h-11 p-1.5"
            />
          </Field>
        </div>
        <Button type="submit" disabled={cardPending}>
          {cardPending ? "Saving…" : "Save team card"}
        </Button>
      </form>
    </Panel>
  );
}

/**
 * Positions, jerseys, and who starts — one form for the whole roster.
 *
 * Starters are checkboxes rather than a drag list on purpose: this gets used
 * on a phone in a gym, and the order within the five matters far less than
 * which five they are.
 */
export function LineupEditor({
  slug,
  sport,
  teamId,
  roster,
  jerseys = true,
}: {
  slug: string;
  sport: string;
  teamId: string;
  roster: RosterEntry[];
  /** Off in leagues that don't hand out shirts — see the Console setting. */
  jerseys?: boolean;
}) {
  const [state, action, pending] = useActionState(updateLineup, EMPTY);
  const options = positionsFor(sport);
  const [starters, setStarters] = useState<Set<string>>(
    () => new Set(roster.filter((r) => r.lineup_role === "starter").map((r) => r.id)),
  );

  return (
    <Panel
      eyebrow="Captain"
      title="Lineup and reserves"
      action={
        <span className="num text-[15px] text-ink-body">
          {starters.size} starting · {roster.length - starters.size} reserve
        </span>
      }
    >
      <form action={action} className="space-y-4">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="team_id" value={teamId} />
        <input type="hidden" name="sport" value={sport} />
        <FormError message={state.error} />
        <FormNotice message={state.notice} />

        {roster.length === 0 ? (
          <p className="text-[15px] text-ink-body">
            Nobody on the roster yet — players arrive through the draft, a
            trade, or the commissioner adding them on the Teams tab.
          </p>
        ) : (
          <ul className="space-y-2">
            {roster.map((m) => {
              const starting = starters.has(m.id);
              return (
                <li
                  key={m.id}
                  className={
                    starting
                      // A starter is marked by an edge, not by a fill: five
                      // filled rows in a row reads as an alert, not a lineup.
                      ? "flex flex-wrap items-center gap-3 rounded-panel border border-rule border-l-[3px] border-l-accent bg-paper px-3 py-2.5"
                      : "flex flex-wrap items-center gap-3 rounded-panel border border-rule bg-paper px-3 py-2.5 opacity-80"
                  }
                >
                  <input type="hidden" name="member_id" value={m.id} />
                  <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      name="starter"
                      value={m.id}
                      checked={starting}
                      onChange={(e) => {
                        setStarters((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(m.id);
                          else next.delete(m.id);
                          return next;
                        });
                      }}
                      className="size-5 shrink-0 accent-[var(--color-accent)]"
                    />
                    <Avatar name={m.full_name} src={m.avatar_url} size={32} />
                    <span className="min-w-0 truncate font-semibold">
                      {m.full_name}
                      {m.is_captain ? (
                        <span className="label ml-2 !text-[10px]">captain</span>
                      ) : null}
                    </span>
                  </label>
                  <label className={jerseys ? "flex items-center gap-2" : "hidden"}>
                    <span className="label !text-[10px]">No.</span>
                    <Input
                      name={`jersey:${m.id}`}
                      type="number"
                      min={0}
                      max={99}
                      defaultValue={m.jersey_number ?? ""}
                      aria-label={`Jersey number for ${m.full_name}`}
                      className="num !w-20"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="label !text-[10px]">Pos</span>
                    <Select
                      name={`position:${m.id}`}
                      defaultValue={m.position ?? ""}
                      aria-label={`Position for ${m.full_name}`}
                      className="!w-32"
                    >
                      <option value="">—</option>
                      {options.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.value} · {p.label}
                        </option>
                      ))}
                    </Select>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        {roster.length > 0 ? (
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save lineup"}
          </Button>
        ) : null}
      </form>
    </Panel>
  );
}
