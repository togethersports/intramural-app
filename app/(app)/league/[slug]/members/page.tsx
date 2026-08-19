import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { Avatar, RoleBadge, Panel } from "@/components/ui";
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
      {admin ? (
        <Panel
          eyebrow="Invite"
          title="Anyone with this code can join"
          action={
            <div className="flex gap-2">
              <CopyButton text={league.join_code} label="Copy code" />
              <CopyButton
                text={league.join_code}
                getText="invite-link"
                label="Copy invite link"
              />
            </div>
          }
        >
          <p className="num text-[34px] leading-none tracking-[0.3em]">
            {league.join_code}
          </p>
        </Panel>
      ) : null}

      <Panel
        eyebrow="Roster"
        title={`${members.length} ${members.length === 1 ? "member" : "members"}`}
        flush
      >
        <div className="divide-y divide-rule">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center gap-3 px-5 py-3.5 sm:px-6"
            >
              <Avatar name={m.full_name} src={m.avatar_url} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{m.full_name}</p>
                <p className="text-sm text-ink-body">
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
        </div>
      </Panel>
    </div>
  );
}
