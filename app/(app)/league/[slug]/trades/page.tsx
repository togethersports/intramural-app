import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconUsers } from "@/components/icons";
import { EmptyState } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import {
  getActiveSeason,
  getLeague,
  getTeamsWithRosters,
  getTrades,
} from "@/lib/data";
import { isLeagueAdmin } from "@/packages/core/league-constants";
import type { TradeRow } from "@/packages/core/types";
import {
  cancelTradeAction,
  resolveTradeAction,
  respondTradeAction,
} from "../actions";
import { TradeForm } from "./trade-form";

export const metadata: Metadata = { title: "Trades" };

const STATUS_TONE: Record<TradeRow["status"], string> = {
  proposed: "bg-tint text-accent",
  accepted: "bg-bench text-white",
  executed: "bg-ink text-white",
  declined: "bg-rule text-ink-faint",
  cancelled: "bg-rule text-ink-faint",
  vetoed: "bg-tint text-accent",
};

export default async function TradesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();
  const league = await getLeague(slug);
  if (!league) notFound();
  const admin = isLeagueAdmin(league.role);
  const season = await getActiveSeason(league.id);

  if (!season) {
    return (
      <div className="card p-6">
        <EmptyState icon={<IconUsers size={26} />} title="No season yet" />
      </div>
    );
  }

  const [teams, trades] = await Promise.all([
    getTeamsWithRosters(season.id),
    getTrades(season.id),
  ]);
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const myTeam = teams.find((t) => t.captain_id === user.id) ?? null;

  const open = trades.filter((t) => t.status === "proposed" || t.status === "accepted");
  const history = trades.filter((t) => t.status !== "proposed" && t.status !== "accepted");

  const renderSides = (t: TradeRow) => {
    const fromPlayers = t.items.filter((i) => i.from_team_id === t.from_team_id);
    const toPlayers = t.items.filter((i) => i.from_team_id === t.to_team_id);
    return (
      <p className="text-sm text-ink-body">
        <span className="font-semibold text-ink">{teamName.get(t.from_team_id)}</span>{" "}
        send {fromPlayers.map((p) => p.full_name).join(", ") || "—"} ·{" "}
        <span className="font-semibold text-ink">{teamName.get(t.to_team_id)}</span>{" "}
        send {toPlayers.map((p) => p.full_name).join(", ") || "—"}
      </p>
    );
  };

  return (
    <div className="space-y-5">
      {myTeam ? (
        <section className="card p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold tracking-tight">
            Build a trade
          </h2>
          <TradeForm slug={slug} seasonId={season.id} myTeam={myTeam} teams={teams} />
        </section>
      ) : null}

      <section className="card p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">
          Open trades
        </h2>
        {open.length === 0 ? (
          <p className="text-sm text-ink-faint">Nothing on the table.</p>
        ) : (
          <ul className="space-y-3">
            {open.map((t) => {
              const iAmCounterparty =
                teams.find((tm) => tm.id === t.to_team_id)?.captain_id === user.id;
              const iProposed = t.proposed_by === user.id;
              return (
                <li key={t.id} className="rounded-panel bg-paper p-4">
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${STATUS_TONE[t.status]}`}
                    >
                      {t.status === "accepted" ? "awaiting commissioner" : t.status}
                    </span>
                    <span className="text-xs text-ink-faint">
                      {new Date(t.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  {renderSides(t)}
                  {t.note ? (
                    <p className="mt-1 text-sm italic text-ink-faint">“{t.note}”</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {t.status === "proposed" && iAmCounterparty ? (
                      <>
                        <form action={respondTradeAction}>
                          <input type="hidden" name="trade_id" value={t.id} />
                          <input type="hidden" name="accept" value="true" />
                          <input type="hidden" name="slug" value={slug} />
                          <button className="min-h-11 rounded-control bg-ink px-4 text-sm font-semibold text-white">
                            Accept
                          </button>
                        </form>
                        <form action={respondTradeAction}>
                          <input type="hidden" name="trade_id" value={t.id} />
                          <input type="hidden" name="accept" value="false" />
                          <input type="hidden" name="slug" value={slug} />
                          <button className="min-h-11 rounded-control bg-surface px-4 text-sm font-semibold">
                            Decline
                          </button>
                        </form>
                      </>
                    ) : null}
                    {admin && t.status === "accepted" ? (
                      <>
                        <form action={resolveTradeAction}>
                          <input type="hidden" name="trade_id" value={t.id} />
                          <input type="hidden" name="approve" value="true" />
                          <input type="hidden" name="slug" value={slug} />
                          <button className="min-h-11 rounded-control bg-ink px-4 text-sm font-semibold text-surface">
                            Approve + execute
                          </button>
                        </form>
                        <form action={resolveTradeAction}>
                          <input type="hidden" name="trade_id" value={t.id} />
                          <input type="hidden" name="approve" value="false" />
                          <input type="hidden" name="slug" value={slug} />
                          <button className="min-h-11 rounded-control bg-tint px-4 text-sm font-semibold text-accent">
                            Veto
                          </button>
                        </form>
                      </>
                    ) : null}
                    {iProposed && (t.status === "proposed" || t.status === "accepted") ? (
                      <form action={cancelTradeAction}>
                        <input type="hidden" name="trade_id" value={t.id} />
                        <input type="hidden" name="slug" value={slug} />
                        <button className="min-h-11 rounded-control px-4 text-sm font-medium text-ink-faint hover:bg-surface">
                          Withdraw
                        </button>
                      </form>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">
          Transaction log
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-ink-faint">No completed trades yet.</p>
        ) : (
          <ul className="space-y-2.5">
            {history.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 border-t border-rule pt-2.5 first:border-0 first:pt-0">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${STATUS_TONE[t.status]}`}>
                  {t.status}
                </span>
                {renderSides(t)}
              </li>
            ))}
          </ul>
        )}
      </section>

      {!myTeam && !admin ? (
        <p className="text-center text-sm text-white/70">
          Only team captains can propose trades — talk to yours.
        </p>
      ) : null}
    </div>
  );
}
