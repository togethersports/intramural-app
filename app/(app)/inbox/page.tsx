import type { Metadata } from "next";
import Link from "next/link";
import { IconBell } from "@/components/icons";
import { Button, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getNotifications } from "@/lib/data";
import { markAllNotificationsRead } from "../league/[slug]/actions";

export const metadata: Metadata = { title: "Inbox" };

const CATEGORY_ICON: Record<string, string> = {
  draft_clock: "⏱",
  trade: "🔁",
  final_score: "🏀",
  schedule_change: "📅",
  availability_nudge: "🗓",
  scorekeeper: "📋",
};

export default async function InboxPage() {
  await requireUser();
  const notifications = await getNotifications();
  const unread = notifications.filter((n) => !n.read_at);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inbox"
        subtitle={unread.length > 0 ? `${unread.length} unread` : "All caught up"}
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
      <section className="card p-3 sm:p-4">
        {notifications.length === 0 ? (
          <EmptyState
            icon={<IconBell size={26} />}
            title="Nothing yet"
            body="Game finals, trade offers, draft alerts, and schedule changes land here."
          />
        ) : (
          <ul className="divide-y divide-ink/5">
            {notifications.map((n) => {
              const inner = (
                <div className="flex gap-3 px-2 py-3">
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-surface-dim text-base">
                    {CATEGORY_ICON[n.category] ?? "🔔"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${n.read_at ? "font-medium text-ink-soft" : "font-bold"}`}>
                      {n.title}
                    </p>
                    <p className="text-sm text-ink-soft">{n.body}</p>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {new Date(n.created_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {!n.read_at ? (
                    <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-accent" />
                  ) : null}
                </div>
              );
              return (
                <li key={n.id}>
                  {n.link ? (
                    <Link href={n.link} className="block rounded-panel hover:bg-surface-dim/50">
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
