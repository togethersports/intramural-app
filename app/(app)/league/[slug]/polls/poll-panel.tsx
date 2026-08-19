"use client";

import { useActionState, useState } from "react";
import {
  Button,
  Field,
  FormError,
  FormNotice,
  Input,
  Panel,
  Select,
} from "@/components/ui";
import type { SchedulePollRow } from "@/lib/data";
import {
  cancelSchedulePoll,
  castPollVote,
  createSchedulePoll,
  lockSchedulePoll,
  type ActionState,
} from "./actions";

const EMPTY: ActionState = { error: null };

export interface PollOption {
  id: string;
  name: string;
}

function formatDate(iso: string): string {
  // Date-only, so parse it as local noon — parsing a bare date as UTC and
  // rendering it locally shifts it a day west of Greenwich.
  const d = new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
}

/** A yes is worth one, a maybe a half — the same weighting the lock uses. */
function weight(option: { yes: number; maybe: number }): number {
  return option.yes + option.maybe * 0.5;
}

export function SchedulePolls({
  slug,
  seasonId,
  polls,
  teams,
  slots,
  venues,
  canRun,
  myTeamIds,
}: {
  slug: string;
  seasonId: string;
  polls: SchedulePollRow[];
  teams: PollOption[];
  slots: PollOption[];
  venues: PollOption[];
  /** Admin, or captain of at least one team. */
  canRun: boolean;
  myTeamIds: string[];
}) {
  const open = polls.filter((p) => p.status === "open");
  const locked = polls.filter((p) => p.status === "locked").slice(0, 3);

  return (
    <div className="space-y-5">
      {canRun ? (
        <NewPollForm
          slug={slug}
          seasonId={seasonId}
          teams={teams}
          slots={slots}
          venues={venues}
        />
      ) : null}

      <Panel
        eyebrow="Pick a time"
        title="Scheduling polls"
        action={
          <span className="num text-[15px] text-ink-body">
            {open.length} open
          </span>
        }
      >
        {open.length === 0 ? (
          <p className="text-[15px] text-ink-body">
            No polls running.{" "}
            {canRun
              ? "Propose some slots above and both teams can vote."
              : "A captain or the commissioner can start one."}
          </p>
        ) : (
          <ul className="space-y-4">
            {open.map((poll) => (
              <PollCard
                key={poll.id}
                slug={slug}
                poll={poll}
                canRun={
                  canRun &&
                  (myTeamIds.includes(poll.home_team_id) ||
                    myTeamIds.includes(poll.away_team_id) ||
                    myTeamIds.length === 0)
                }
              />
            ))}
          </ul>
        )}

        {locked.length > 0 ? (
          <div className="mt-5 border-t border-rule pt-4">
            <p className="label mb-2 !text-[10px]">Recently locked</p>
            <ul className="space-y-1.5">
              {locked.map((poll) => {
                const winner = poll.options.find(
                  (o) => o.id === poll.locked_option_id,
                );
                return (
                  <li key={poll.id} className="text-[15px] text-ink-body">
                    {poll.home_team_name} vs {poll.away_team_name} —{" "}
                    {winner ? (
                      <span className="font-semibold text-ink">
                        {formatDate(winner.scheduled_date)}
                        {winner.slot_label ? ` · ${winner.slot_label}` : ""}
                      </span>
                    ) : (
                      "locked"
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

function PollCard({
  slug,
  poll,
  canRun,
}: {
  slug: string;
  poll: SchedulePollRow;
  canRun: boolean;
}) {
  const [lockState, lockAction, lockPending] = useActionState(
    lockSchedulePoll,
    EMPTY,
  );
  const best = Math.max(0, ...poll.options.map(weight));

  return (
    <li className="rounded-panel border border-rule bg-paper p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[17px] font-semibold">
          {poll.title || `${poll.home_team_name} vs ${poll.away_team_name}`}
        </p>
        {poll.closes_at ? (
          <p className="label !text-[10px]">
            Closes {formatDate(poll.closes_at.slice(0, 10))}
          </p>
        ) : null}
      </div>

      <FormError message={lockState.error} />
      <FormNotice message={lockState.notice} />

      <ul className="mt-3 space-y-2">
        {poll.options.map((option) => {
          const leading = best > 0 && weight(option) === best;
          return (
            <li
              key={option.id}
              className={
                leading
                  ? "flex flex-wrap items-center gap-3 rounded-row border border-rule border-l-[3px] border-l-accent bg-surface px-3 py-2.5"
                  : "flex flex-wrap items-center gap-3 rounded-row border border-rule bg-surface px-3 py-2.5"
              }
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{formatDate(option.scheduled_date)}</p>
                <p className="text-[13px] text-ink-body">
                  {[option.slot_label, option.venue_name].filter(Boolean).join(" · ") ||
                    "Time and gym TBD"}
                </p>
              </div>

              <span className="num text-[13px] text-ink-body">
                {option.yes} yes
                {option.maybe > 0 ? ` · ${option.maybe} maybe` : ""}
                {option.no > 0 ? ` · ${option.no} no` : ""}
              </span>

              <div className="flex gap-1">
                {(["yes", "maybe", "no"] as const).map((vote) => (
                  <form key={vote} action={castPollVote}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="option_id" value={option.id} />
                    <input type="hidden" name="vote" value={vote} />
                    <button
                      type="submit"
                      aria-pressed={option.myVote === vote}
                      className={
                        option.myVote === vote
                          ? "min-h-11 rounded-full bg-ink px-3.5 text-[13px] font-semibold text-on-ink"
                          : "min-h-11 rounded-full px-3.5 text-[13px] font-medium text-ink-muted transition-colors hover:bg-rule hover:text-ink"
                      }
                    >
                      {vote === "yes" ? "Yes" : vote === "maybe" ? "Maybe" : "No"}
                    </button>
                  </form>
                ))}
              </div>

              {canRun ? (
                <form action={lockAction}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="poll_id" value={poll.id} />
                  <input type="hidden" name="option_id" value={option.id} />
                  <Button
                    type="submit"
                    variant="quiet"
                    disabled={lockPending}
                    className="!min-h-11 !px-4 !text-[13px]"
                  >
                    Lock this
                  </Button>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>

      {canRun ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <form action={lockAction}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="poll_id" value={poll.id} />
            <Button
              type="submit"
              variant="accent"
              disabled={lockPending}
              className="!min-h-11 !px-5 !text-[14px]"
            >
              {lockPending ? "Locking…" : "Lock the winner"}
            </Button>
          </form>
          <form action={cancelSchedulePoll}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="poll_id" value={poll.id} />
            <Button type="submit" variant="quiet" className="!min-h-11 !px-4 !text-[14px]">
              Cancel poll
            </Button>
          </form>
          <p className="w-full text-[13px] text-ink-faint">
            Locking writes the date onto the game and starts its reminders. With
            no option picked, the most votes wins — a maybe counts as half, and a
            tie goes to the earliest date.
          </p>
        </div>
      ) : null}
    </li>
  );
}

const BLANK_OPTION = { date: "", slot: "", venue: "" };

function NewPollForm({
  slug,
  seasonId,
  teams,
  slots,
  venues,
}: {
  slug: string;
  seasonId: string;
  teams: PollOption[];
  slots: PollOption[];
  venues: PollOption[];
}) {
  const [state, action, pending] = useActionState(createSchedulePoll, EMPTY);
  const [options, setOptions] = useState([{ ...BLANK_OPTION }, { ...BLANK_OPTION }]);

  return (
    <Panel eyebrow="Captain or commissioner" title="Propose game times">
      <form action={action} className="space-y-4">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="season_id" value={seasonId} />
        <FormError message={state.error} />
        <FormNotice message={state.notice} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Home team" htmlFor="poll-home">
            <Select id="poll-home" name="home_team_id" defaultValue="" required>
              <option value="" disabled>
                Pick a team
              </option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Away team" htmlFor="poll-away">
            <Select id="poll-away" name="away_team_id" defaultValue="" required>
              <option value="" disabled>
                Pick a team
              </option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div>
          <p className="label mb-2 !text-[11px]">Options to vote on</p>
          <ul className="space-y-2">
            {options.map((option, i) => (
              <li key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <Input
                  name="option_date"
                  type="date"
                  required
                  aria-label={`Date for option ${i + 1}`}
                  value={option.date}
                  onChange={(e) =>
                    setOptions((prev) =>
                      prev.map((o, j) =>
                        j === i ? { ...o, date: e.target.value } : o,
                      ),
                    )
                  }
                />
                <Select
                  name="option_slot"
                  aria-label={`Slot for option ${i + 1}`}
                  value={option.slot}
                  onChange={(e) =>
                    setOptions((prev) =>
                      prev.map((o, j) =>
                        j === i ? { ...o, slot: e.target.value } : o,
                      ),
                    )
                  }
                >
                  <option value="">Any period</option>
                  {slots.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
                <Select
                  name="option_venue"
                  aria-label={`Gym for option ${i + 1}`}
                  value={option.venue}
                  onChange={(e) =>
                    setOptions((prev) =>
                      prev.map((o, j) =>
                        j === i ? { ...o, venue: e.target.value } : o,
                      ),
                    )
                  }
                >
                  <option value="">Any gym</option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </Select>
                {options.length > 1 ? (
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={() =>
                      setOptions((prev) => prev.filter((_, j) => j !== i))
                    }
                    className="!min-h-11 !px-4 !text-[14px]"
                  >
                    Remove
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          {options.length < 8 ? (
            <Button
              type="button"
              variant="quiet"
              onClick={() => setOptions((prev) => [...prev, { ...BLANK_OPTION }])}
              className="mt-2 !min-h-11 !px-4 !text-[14px]"
            >
              Add another option
            </Button>
          ) : null}
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? "Opening…" : "Open the poll"}
        </Button>
      </form>
    </Panel>
  );
}
