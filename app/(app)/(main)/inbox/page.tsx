import type { Metadata } from "next";
import Link from "next/link";
import { Button, EmptyState, Panel } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getNotifications } from "@/lib/data";
import { markAllNotificationsRead } from "../../league/[slug]/actions";

export const metadata: Metadata = { title: "Inbox" };

// No emoji, ever — the mono category label carries it (brandbook 07).
const CATEGORY_LABEL: Record<string, string> = {
  draft_clock: "Draft",
  trade: "Trade",
  final_score: "Final",
  schedule_change: "Schedule",
  availability_nudge: "Availability",
  scorekeeper: "Scorekeeper",
  announcement: "League",
};

export default async function InboxPage() {
  await requireUser();
  const notifications = await getNotifications();
  const unread = notifications.filter((n) => !n.read_at);

  return (
    <div className="space-y-5">
      <Panel
        title={unread.length > 0 ? `${unread.length} unread` : "All caught up"}
        action={
          unread.length > 0 ? (
            <form action={markAllNotificationsRead}>
              <Button
                type="submit"
                variant="quiet"
                className="!min-h-10 !px-4 !py-2 !text-[14px]"
              >
                Mark all read
              </Button>
            </form>
          ) : undefined
        }
      >
        {notifications.length === 0 ? (
          <EmptyState
            title="Nothing yet"
            body="Game finals, trade offers, draft alerts, and schedule changes land here."
          />
        ) : (
          <ul className="space-y-1.5">
            {notifications.map((n) => {
              const inner = (
                // The category used to hold a fixed column of its own, which
                // spent a quarter of the row on one word and squeezed every
                // message. It rides the timestamp line now; the message gets
                // the width.
                <div className="row flex gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-[17px] ${
                        n.read_at ? "font-medium text-ink-body" : "font-semibold"
                      }`}
                    >
                      {n.title}
                    </p>
                    <p className="max-w-[72ch] text-[17px] leading-relaxed text-ink-body">
                      {n.body}
                    </p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[13px] text-ink-faint">
                      <span className="label !text-[10.5px]">
                        {CATEGORY_LABEL[n.category] ?? "Update"}
                      </span>
                      <span aria-hidden>·</span>
                      <span className="num">
                        {new Date(n.created_at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </p>
                  </div>
                  {!n.read_at ? (
                    <span
                      aria-label="Unread"
                      className="mt-2 size-2 shrink-0 rounded-full bg-accent"
                    />
                  ) : null}
                </div>
              );
              return (
                <li key={n.id}>
                  {n.link ? (
                    <Link href={n.link} className="block">
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
