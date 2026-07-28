import type { Metadata } from "next";
import Link from "next/link";
import {
  IconArrowRight,
  IconCalendar,
  IconChart,
  IconPlus,
  IconTicket,
  IconTrophy,
} from "@/components/icons";
import {
  ButtonLink,
  EmptyState,
  PageHeader,
  RoleBadge,
} from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getMyLeagues, sportLabel } from "@/lib/leagues";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: profile }, leagues] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle(),
    getMyLeagues(),
  ]);
  const firstName = (profile?.full_name || "there").split(" ")[0];

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        subtitle="Here's where your leagues stand."
        actions={
          <>
            <ButtonLink href="/join" variant="canvas">
              <IconTicket size={18} /> Join
            </ButtonLink>
            <ButtonLink href="/leagues/new" variant="primary">
              <IconPlus size={18} /> Start a league
            </ButtonLink>
          </>
        }
      />

      {/* My leagues */}
      <section className="card p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">
          My leagues
        </h2>
        {leagues.length === 0 ? (
          <EmptyState
            icon={<IconTrophy size={28} />}
            title="You're not in a league yet"
            body="Start one as commissioner, or join with the 6-character code from yours."
            action={
              <div className="flex gap-2">
                <ButtonLink href="/leagues/new" variant="primary">
                  Start a league
                </ButtonLink>
                <ButtonLink href="/join" variant="soft">
                  I have a code
                </ButtonLink>
              </div>
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {leagues.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/league/${l.slug}`}
                  className="group flex min-h-11 items-center gap-4 rounded-panel bg-surface-dim/60 p-4 transition-colors hover:bg-surface-dim"
                >
                  <span
                    aria-hidden
                    className="grid size-12 shrink-0 place-items-center rounded-[14px] text-lg font-bold text-white"
                    style={{ backgroundColor: l.primary_color }}
                  >
                    {l.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold">{l.name}</span>
                      <RoleBadge role={l.role} />
                    </span>
                    <span className="text-sm text-ink-soft">
                      {sportLabel(l.sport)}
                    </span>
                  </span>
                  <IconArrowRight
                    size={18}
                    className="text-ink-faint transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Coming with later phases — honest placeholders */}
      <div className="grid gap-5 sm:grid-cols-2">
        <section className="card p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold tracking-tight">
            Next game
          </h2>
          <EmptyState
            icon={<IconCalendar size={26} />}
            title="No games scheduled"
            body="Scheduling into lunch and free periods arrives in Phase 2."
          />
        </section>
        <section className="card p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold tracking-tight">
            My last stat line
          </h2>
          <EmptyState
            icon={<IconChart size={26} />}
            title="No stats yet"
            body="The live game tracker and box scores arrive in Phase 3."
          />
        </section>
      </div>
    </div>
  );
}
