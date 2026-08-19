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
import type { SubRequestRow } from "@/lib/data";
import {
  cancelSubRequest,
  decideSub,
  flagAbsence,
  proposeSub,
  type ActionState,
} from "./actions";

const EMPTY: ActionState = { error: null };

export interface SubViewer {
  userId: string;
  /** The team the viewer plays for in this game, if either. */
  myTeamId: string | null;
  /** Teams in this game the viewer captains. */
  captainOf: string[];
  isAdmin: boolean;
  /** Already flagged as out for this game. */
  isAbsent: boolean;
}

const STATUS_COPY: Record<SubRequestRow["status"], string> = {
  open: "Looking for somebody",
  proposed: "Waiting on the other captain",
  approved: "Approved",
  declined: "Declined",
  cancelled: "Withdrawn",
};

/**
 * Absences and subs for one game.
 *
 * The rule this surface exists to make visible: a team cannot approve its
 * own sub. Whoever is filling in has to be signed off by the *opposing*
 * captain (or a league admin), and the panel says who that is at every step
 * rather than leaving people to guess whose turn it is.
 */
export function SubPanel({
  slug,
  gameId,
  homeTeamId,
  awayTeamId,
  teamNames,
  requests,
  absences,
  viewer,
  locked,
}: {
  slug: string;
  gameId: string;
  homeTeamId: string;
  awayTeamId: string;
  teamNames: Record<string, string>;
  requests: SubRequestRow[];
  absences: { user_id: string; team_id: string; reason: string; full_name: string }[];
  viewer: SubViewer;
  /** Final games don't take new absences. */
  locked: boolean;
}) {
  const live = requests.filter((r) => r.status !== "cancelled");
  const canFlag = Boolean(viewer.myTeamId) && !locked && !viewer.isAbsent;

  return (
    <Panel
      eyebrow="Who's playing"
      title="Absences and subs"
      action={
        live.length > 0 ? (
          <span className="num text-[15px] text-ink-body">
            {live.filter((r) => r.status === "open" || r.status === "proposed").length}{" "}
            open
          </span>
        ) : null
      }
    >
      {canFlag ? <FlagForm slug={slug} gameId={gameId} teamId={viewer.myTeamId!} /> : null}

      {viewer.isAbsent ? (
        <p className="mb-4 rounded-panel bg-tint px-4 py-3 text-[15px] font-medium text-accent-ink">
          You&apos;re marked as out for this game. Your team can see it.
        </p>
      ) : null}

      {absences.length === 0 && live.length === 0 ? (
        <p className="text-[15px] text-ink-body">
          Everybody is in. If you can&apos;t make it, say so here and your team —
          and the league&apos;s sub pool — will know.
        </p>
      ) : null}

      {live.length > 0 ? (
        <ul className="space-y-3">
          {live.map((request) => {
            const opponentId =
              request.team_id === homeTeamId ? awayTeamId : homeTeamId;
            // The sign-off belongs to the other side. This is the whole point
            // of the feature, so it decides what the row offers.
            const canDecide =
              viewer.isAdmin || viewer.captainOf.includes(opponentId);
            const onThisTeam =
              viewer.myTeamId === request.team_id ||
              viewer.captainOf.includes(request.team_id);
            const canWithdraw =
              viewer.isAdmin ||
              request.requested_by === viewer.userId ||
              viewer.captainOf.includes(request.team_id);
            // Anyone in the league can volunteer for a league-scope hole;
            // a team-scope one is for that team's own players.
            const canVolunteer =
              request.status === "open" &&
              (request.scope === "league" || onThisTeam) &&
              request.fill_user_id !== viewer.userId &&
              viewer.myTeamId !== opponentId;

            return (
              <li
                key={request.id}
                className="rounded-panel border border-rule bg-paper px-4 py-3.5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="label !text-[10px]">
                    {teamNames[request.team_id] ?? "Team"} ·{" "}
                    {request.scope === "league" ? "League-wide" : "Team only"}
                  </p>
                  <p
                    className={
                      request.status === "approved"
                        ? "label !text-[10px] !text-positive"
                        : request.status === "declined"
                          ? "label !text-[10px] !text-accent-ink"
                          : "label !text-[10px]"
                    }
                  >
                    {STATUS_COPY[request.status]}
                  </p>
                </div>

                <p className="mt-1.5 text-[15px]">
                  {request.absent_name ? (
                    <>
                      <span className="font-semibold">{request.absent_name}</span> is
                      out
                    </>
                  ) : (
                    "A player is out"
                  )}
                  {request.fill_name ? (
                    <>
                      {" — "}
                      <span className="font-semibold">{request.fill_name}</span> would
                      fill in
                    </>
                  ) : null}
                  .
                </p>
                {request.note ? (
                  <p className="mt-1 text-[14px] text-ink-body">{request.note}</p>
                ) : null}
                {request.decision_note ? (
                  <p className="mt-1 text-[14px] text-ink-body">
                    Note from the decision: {request.decision_note}
                  </p>
                ) : null}

                {request.status === "proposed" && !canDecide ? (
                  <p className="mt-2 text-[14px] text-ink-faint">
                    {teamNames[opponentId] ?? "The other team"}&apos;s captain has to
                    approve this before it counts.
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  {canVolunteer ? (
                    <VolunteerForm slug={slug} requestId={request.id} />
                  ) : null}
                  {request.status === "proposed" && canDecide ? (
                    <DecideForm slug={slug} requestId={request.id} />
                  ) : null}
                  {canWithdraw &&
                  (request.status === "open" || request.status === "proposed") ? (
                    <form action={cancelSubRequest}>
                      <input type="hidden" name="request_id" value={request.id} />
                      <input type="hidden" name="slug" value={slug} />
                      <Button
                        type="submit"
                        variant="quiet"
                        className="!min-h-11 !px-4 !text-[14px]"
                      >
                        Withdraw
                      </Button>
                    </form>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </Panel>
  );
}

function FlagForm({
  slug,
  gameId,
  teamId,
}: {
  slug: string;
  gameId: string;
  teamId: string;
}) {
  const [state, action, pending] = useActionState(flagAbsence, EMPTY);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="mb-4">
        <FormNotice message={state.notice} />
        <Button
          type="button"
          variant="quiet"
          onClick={() => setOpen(true)}
          className="!min-h-11 !px-5 !text-[15px]"
        >
          I can&apos;t make this game
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="mb-5 space-y-4 rounded-panel bg-paper p-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="game_id" value={gameId} />
      <input type="hidden" name="team_id" value={teamId} />
      <FormError message={state.error} />
      <FormNotice message={state.notice} />

      <Field label="Why, roughly" htmlFor="reason" hint="Your team sees this.">
        <Input
          id="reason"
          name="reason"
          maxLength={140}
          placeholder="Away at a meet — back next week"
        />
      </Field>
      <Field label="Who should we ask" htmlFor="scope">
        <Select id="scope" name="scope" defaultValue="league">
          <option value="league">My team and the league sub pool</option>
          <option value="team">Just my team</option>
        </Select>
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Flagging…" : "Flag it"}
        </Button>
        <Button type="button" variant="quiet" onClick={() => setOpen(false)}>
          Never mind
        </Button>
      </div>
    </form>
  );
}

function VolunteerForm({ slug, requestId }: { slug: string; requestId: string }) {
  const [state, action, pending] = useActionState(proposeSub, EMPTY);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="request_id" value={requestId} />
      <Button
        type="submit"
        variant="accent"
        disabled={pending}
        className="!min-h-11 !px-5 !text-[14px]"
      >
        {pending ? "Offering…" : "I'll sub"}
      </Button>
      <FormError message={state.error} />
    </form>
  );
}

function DecideForm({ slug, requestId }: { slug: string; requestId: string }) {
  const [state, action, pending] = useActionState(decideSub, EMPTY);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="request_id" value={requestId} />
      <Input
        name="decision_note"
        maxLength={140}
        placeholder="Optional note"
        className="!w-52 !min-h-11 !text-[15px]"
      />
      <Button
        type="submit"
        name="decision"
        value="approve"
        variant="accent"
        disabled={pending}
        className="!min-h-11 !px-5 !text-[14px]"
      >
        Approve
      </Button>
      <Button
        type="submit"
        name="decision"
        value="decline"
        variant="quiet"
        disabled={pending}
        className="!min-h-11 !px-5 !text-[14px]"
      >
        Decline
      </Button>
      <FormError message={state.error} />
    </form>
  );
}
