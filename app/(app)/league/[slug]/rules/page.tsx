import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui";
import { getLeague, getLeagueRules, getRuleFiles } from "@/lib/data";
import { isLeagueAdmin } from "@/packages/core/league-constants";
import { createClient } from "@/lib/supabase/server";
import { deleteRuleFile } from "../actions";
import { RuleFileUpload, RulesEditor } from "./rules-forms";

export const metadata: Metadata = { title: "Rules" };

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

export default async function RulesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeague(slug);
  if (!league) notFound();
  const admin = isLeagueAdmin(league.role);

  const [content, files] = await Promise.all([
    getLeagueRules(league.id),
    getRuleFiles(league.id),
  ]);

  // signed URLs for the private bucket, one batch call
  const supabase = await createClient();
  const { data: signed } =
    files.length > 0
      ? await supabase.storage
          .from("rules")
          .createSignedUrls(
            files.map((f) => f.storage_path),
            60 * 60,
          )
      : { data: [] };
  const urlByPath = new Map(
    (signed ?? []).map((s) => [s.path, s.signedUrl] as const),
  );

  // blank lines split sections; lines render as paragraphs
  const sections = content
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="space-y-5">
      <section className="card p-5 sm:p-6">
        <h2 className="mb-1 text-lg font-semibold tracking-tight">
          League rules
        </h2>
        <p className="mb-4 text-sm text-ink-muted">
          {admin
            ? "What you write here is what players see. Keep it on the record."
            : "Set by the commissioner. Arguments end here."}
        </p>
        {admin ? (
          <RulesEditor slug={slug} leagueId={league.id} content={content} />
        ) : sections.length === 0 ? (
          <EmptyState
            title="No rules posted yet"
            body="The commissioner hasn't written the rules. Until then, house rules apply."
          />
        ) : (
          <div className="space-y-4">
            {sections.map((section, i) => (
              <div key={i} className="row px-5 py-4">
                {section.split("\n").map((line, j) => (
                  <p
                    key={j}
                    className="max-w-[70ch] text-[17px] leading-[1.55] text-ink-body"
                  >
                    {line}
                  </p>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="mb-1 text-lg font-semibold tracking-tight">
          Rule documents
        </h2>
        <p className="mb-4 text-sm text-ink-muted">
          Official documents — rulebooks, waivers, code of conduct.
        </p>
        {files.length === 0 ? (
          <p className="text-sm text-ink-faint">
            {admin
              ? "Nothing uploaded yet."
              : "No documents yet — check the written rules above."}
          </p>
        ) : (
          <ul className="mb-4 space-y-2">
            {files.map((f) => {
              const url = urlByPath.get(f.storage_path);
              return (
                <li
                  key={f.id}
                  className="row flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <span className="label w-16 shrink-0">
                    {f.name.split(".").pop()?.toUpperCase().slice(0, 4) ?? "FILE"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[17px] font-medium">
                    {f.name}
                  </span>
                  <span className="num text-[13px] text-ink-faint">
                    {formatBytes(f.size_bytes)}
                  </span>
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center rounded-full bg-ink px-4 text-sm font-semibold text-white hover:bg-black"
                    >
                      Open
                    </a>
                  ) : null}
                  {admin ? (
                    <form action={deleteRuleFile}>
                      <input type="hidden" name="file_id" value={f.id} />
                      <input type="hidden" name="slug" value={slug} />
                      <button className="min-h-11 rounded-full px-3 text-sm font-medium text-accent hover:bg-tint">
                        Remove
                      </button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {admin ? <RuleFileUpload slug={slug} leagueId={league.id} /> : null}
      </section>
    </div>
  );
}
