import type { Metadata } from "next";
import Link from "next/link";
import { Button, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getNotifications } from "@/lib/data";
import { markAllNotificationsRead } from "../league/[slug]/actions";

export const metadata: Metadata = { title: "Inbox" };

// No emoji, ever — the mono category label carries it (brandbook 07).
const CATEGORY_LABEL: Record<string, string> = {
  draft_clock: "Draft",
  trade: "Trade",
  final_score: "Final",
  schedule_change: "Schedule",
  availability_nudge: "Availability",
  scorekeeper: "Scorekeeper",
};

export default async function InboxPage() {
  await requireUser();
  const notifications = await getNotifications();
  const unread = notifications.filter((n) => !n.read_at);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inbox"
        subtitle={
          unread.length > 0 ? `${unread.length} unread` : "All caught up"
        }
        actions={
          unread.length > 0 ? (
            <form action={markAllNotificationsRead}>
              <Button type="submit" variant="canvas">
                Mark all read
              </Button>
            </form>
          ) : undefined
        }
      />
      <section className="card p-4">
        {notifications.length === 0 ? (
          <EmptyState
            title="Nothing yet"
            body="Game finals, trade offers, draft alerts, and schedule changes land here."
          />
        ) : (
          <ul className="space-y-1.5">
            {notifications.map((n) => {
              const inner = (
                <div className="row flex gap-4 px-4 py-3.5">
                  <span className="label w-24 shrink-0 pt-1">
                    {CATEGORY_LABEL[n.category] ?? "Update"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-[17px] ${
                        n.read_at ? "font-medium text-ink-body" : "font-semibold"
                      }`}
                    >
                      {n.title}
                    </p>
                    <p className="max-w-[62ch] text-[17px] leading-relaxed text-ink-body">
                      {n.body}
                    </p>
                    <p className="num mt-1 text-[13px] text-ink-faint">
                      {new Date(n.created_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
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
      </section>
    </div>
  );
}
