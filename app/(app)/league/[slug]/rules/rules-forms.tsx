"use client";

import { useActionState } from "react";
import { saveRules, uploadRuleFile, type ActionState } from "../actions";
import { Button, FormError, FormNotice } from "@/components/ui";

const initial: ActionState = { error: null };

export function RulesEditor({
  slug,
  leagueId,
  content,
}: {
  slug: string;
  leagueId: string;
  content: string;
}) {
  const [state, formAction, pending] = useActionState(saveRules, initial);
  return (
    <form action={formAction} className="space-y-3">
      <FormError message={state.error} />
      <FormNotice message={state.notice} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="league_id" value={leagueId} />
      <textarea
        name="content"
        rows={14}
        defaultValue={content}
        placeholder={
          "Write the league rules here. Blank lines start a new section.\n\n" +
          "1. Games are 4 periods of 10 minutes, running clock.\n" +
          "2. Rosters lock at tip-off — no-shows after 5 minutes forfeit."
        }
        className="w-full rounded-control border border-rule bg-paper px-4 py-3 text-[17px] leading-[1.55] placeholder:text-ink-faint focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10"
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save rules"}
      </Button>
    </form>
  );
}

export function RuleFileUpload({
  slug,
  leagueId,
}: {
  slug: string;
  leagueId: string;
}) {
  const [state, formAction, pending] = useActionState(uploadRuleFile, initial);
  return (
    <form action={formAction} className="space-y-3">
      <FormError message={state.error} />
      <FormNotice message={state.notice} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="league_id" value={leagueId} />
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="file"
          required
          accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg"
          className="min-h-11 max-w-full text-[15px] file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-full file:border-0 file:bg-rule file:px-5 file:font-semibold file:text-ink hover:file:bg-surface"
        />
        <Button type="submit" disabled={pending} variant="quiet">
          {pending ? "Uploading…" : "Upload"}
        </Button>
      </div>
      <p className="text-sm text-ink-muted">
        PDF, Word, text, or images up to 10 MB. Players can view and download.
      </p>
    </form>
  );
}
