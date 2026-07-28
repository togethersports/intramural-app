import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { Avatar, PageHeader, RoleBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import {
  getLeagueBySlug,
  getLeagueMembers,
  isLeagueAdmin,
} from "@/lib/leagues";
import { MemberControls } from "./member-controls";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();
  const members = await getLeagueMembers(league.id);
  const admin = isLeagueAdmin(league.role);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Members"
        subtitle={
          <>
            <Link href={`/league/${league.slug}`} className="underline">
              {league.name}
            </Link>
            {" · "}
            {members.length} active
          </>
        }
      />

      {admin ? (
        <section className="card flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-sm font-medium text-ink-soft">
              Invite with this code
            </p>
            <p className="stat-num font-mono text-3xl tracking-[0.3em]">
              {league.join_code}
            </p>
          </div>
          <div className="flex gap-2">
            <CopyButton text={league.join_code} label="Copy code" />
            <CopyButton
              text={league.join_code}
              getText="invite-link"
              label="Copy invite link"
            />
          </div>
        </section>
      ) : null}

      <section className="card divide-y divide-ink/5 p-2 sm:p-3">
        {members.map((m) => (
          <div
            key={m.id}
            className="flex flex-wrap items-center gap-3 px-3 py-3"
          >
            <Avatar name={m.full_name} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{m.full_name}</p>
              <p className="text-sm text-ink-soft">
                {m.grade ? `Grade ${m.grade}` : "Grade —"}
              </p>
            </div>
            <RoleBadge role={m.role} />
            {admin ? (
              <MemberControls
                memberId={m.id}
                slug={league.slug}
                role={m.role}
                isSelf={m.user_id === user.id}
              />
            ) : null}
          </div>
        ))}
      </section>
    </div>
  );
}
