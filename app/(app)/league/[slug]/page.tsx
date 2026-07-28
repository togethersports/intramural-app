import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import {
  IconArrowRight,
  IconCalendar,
  IconTrophy,
  IconUsers,
} from "@/components/icons";
import { EmptyState, RoleBadge, StatTile } from "@/components/ui";
import {
  getLeagueBySlug,
  getLeagueMembers,
  isLeagueAdmin,
  sportLabel,
} from "@/lib/leagues";

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();
  const members = await getLeagueMembers(league.id);
  const admin = isLeagueAdmin(league.role);

  return (
    <div className="space-y-5">
      {/* League hero */}
      <section
        className="card overflow-hidden"
        style={{ backgroundColor: league.primary_color }}
      >
        <div className="flex flex-wrap items-end justify-between gap-4 p-6 sm:p-8">
          <div>
            <p className="text-sm font-medium text-white/70">
              {sportLabel(league.sport)}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {league.name}
            </h1>
            <div className="mt-3 flex items-center gap-2">
              <span className="chip">{members.length} members</span>
              <RoleBadge role={league.role} />
            </div>
          </div>
          {admin ? (
            <div className="rounded-panel bg-white/15 p-4 backdrop-blur">
              <p className="text-xs font-medium text-white/80">Join code</p>
              <p className="stat-num mt-0.5 font-mono text-2xl tracking-[0.3em] text-white">
                {league.join_code}
              </p>
              <div className="mt-2">
                <CopyButton
                  text={league.join_code}
                  getText="invite-link"
                  label="Copy invite link"
                />
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* Snapshot tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatTile
          label="Members"
          value={members.length}
          icon={<IconUsers size={17} />}
        />
        <StatTile label="Teams" value="—" icon={<IconTrophy size={17} />}>
          <p className="text-xs text-ink-faint">Draft arrives in Phase 1</p>
        </StatTile>
        <StatTile
          label="Games this week"
          value="—"
          icon={<IconCalendar size={17} />}
          className="col-span-2 lg:col-span-1"
        >
          <p className="text-xs text-ink-faint">Scheduling arrives in Phase 2</p>
        </StatTile>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Roster preview */}
        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Roster</h2>
            <Link
              href={`/league/${league.slug}/members`}
              className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink"
            >
              {admin ? "Manage" : "View all"} <IconArrowRight size={16} />
            </Link>
          </div>
          <ul className="space-y-1">
            {members.slice(0, 6).map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-panel px-2 py-2"
              >
                <span className="truncate font-medium">{m.full_name}</span>
                <RoleBadge role={m.role} />
              </li>
            ))}
          </ul>
        </section>

        {/* Standings placeholder */}
        <section className="card p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold tracking-tight">
            Standings
          </h2>
          <EmptyState
            icon={<IconTrophy size={26} />}
            title="No season yet"
            body="Standings light up once teams are drafted and games go final."
          />
        </section>
      </div>
    </div>
  );
}
