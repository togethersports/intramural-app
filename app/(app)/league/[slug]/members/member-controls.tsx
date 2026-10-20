"use client";

import { useRef, useTransition } from "react";
import { removeMember, updateMemberRole } from "../../../actions";
import { ASSIGNABLE_ROLES } from "@core/league-constants";

export function MemberControls({
  memberId,
  slug,
  role,
  isSelf,
}: {
  memberId: string;
  slug: string;
  role: string;
  isSelf: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  if (role === "commissioner") return null;

  return (
    <div className="flex items-center gap-2">
      <form ref={formRef} action={updateMemberRole}>
        <input type="hidden" name="member_id" value={memberId} />
        <input type="hidden" name="slug" value={slug} />
        <select
          name="role"
          defaultValue={role}
          disabled={pending}
          aria-label="Change role"
          onChange={() =>
            startTransition(() => formRef.current?.requestSubmit())
          }
          className="min-h-11 rounded-control border border-rule bg-paper px-3 text-sm font-medium capitalize focus:border-ink/30 focus:outline-none"
        >
          {ASSIGNABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </form>
      {!isSelf ? (
        <form action={removeMember}>
          <input type="hidden" name="member_id" value={memberId} />
          <input type="hidden" name="slug" value={slug} />
          <button
            type="submit"
            className="min-h-11 rounded-control px-3 text-sm font-medium text-accent-ink transition-colors hover:bg-tint"
          >
            Remove
          </button>
        </form>
      ) : null}
    </div>
  );
}
