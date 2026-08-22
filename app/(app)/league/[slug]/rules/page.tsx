import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState, Panel } from "@/components/ui";
import { getLeague, getLeagueRules, getRuleFiles } from "@/lib/data";
import { isLeagueAdmin } from "@core/league-constants";
import { createClient } from "@/lib/supabase/server";
import { deleteRuleFile, setPrimaryRuleFile } from "../actions";
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

  const kindOf = (name: string): "pdf" | "image" | "other" =>
    name.toLowerCase().endsWith(".pdf")
      ? "pdf"
      : /\.(png|jpe?g|webp|gif)$/i.test(name)
        ? "image"
        : "other";

  // Uploading the rulebook *is* the intent to show it. Waiting for a second,
  // separate "show this one" click left leagues with a page that said no
  // rules while the rules sat two clicks away as a download. So the flagged
  // file wins if there is one, and otherwise the first file we can actually
  // render takes the slot on its own.
  const primary =
    files.find((f) => f.is_primary) ??
    files.find((f) => kindOf(f.name) !== "other");
  const primaryUrl = primary ? urlByPath.get(primary.storage_path) : undefined;
  const primaryKind = primary ? kindOf(primary.name) : "other";

  return (
    <div className="space-y-5">
      {primary && primaryUrl ? (
        <Panel title={primary.name} flush>
          {primaryKind === "pdf" ? (
            <iframe
              src={primaryUrl}
              title={primary.name}
              className="h-[78vh] w-full border-0 bg-paper"
            />
          ) : primaryKind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={primaryUrl} alt={primary.name} className="w-full" />
          ) : (
            <div className="px-5 py-6">
              <p className="mb-3 text-[17px] text-ink-body">
                This document can&apos;t be shown on the page — open it to read it.
              </p>
              <a
                href={primaryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-on-ink hover:opacity-90"
              >
                Open the rule sheet
              </a>
            </div>
          )}
        </Panel>
      ) : null}

      <Panel eyebrow="On the record" title="League rules">
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
      </Panel>

      <Panel eyebrow="Files" title="Rule documents">
        <p className="mb-4 max-w-[62ch] text-sm text-ink-muted">
          Official documents — rulebooks, waivers, code of conduct. The newest
          PDF or image shows at the top of this page as the league&apos;s rule
          sheet; pin one to keep it there when you upload more.
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
                    {f.id === primary?.id ? (
                      <span className="label ml-2 !text-[10px] !text-accent-ink">
                        Rule sheet
                      </span>
                    ) : null}
                  </span>
                  <span className="num text-[13px] text-ink-faint">
                    {formatBytes(f.size_bytes)}
                  </span>
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center rounded-full bg-ink px-4 text-sm font-semibold text-on-ink hover:opacity-90"
                    >
                      Open
                    </a>
                  ) : null}
                  {admin ? (
                    <form action={setPrimaryRuleFile}>
                      <input type="hidden" name="file_id" value={f.id} />
                      <input type="hidden" name="league_id" value={league.id} />
                      <input type="hidden" name="slug" value={slug} />
                      <button className="min-h-11 rounded-full px-3 text-sm font-medium text-ink-muted hover:bg-paper hover:text-ink">
                        {f.is_primary
                          ? "Unset as rule sheet"
                          : f.id === primary?.id
                            ? "Pin as rule sheet"
                            : "Show on the page"}
                      </button>
                    </form>
                  ) : null}
                  {admin ? (
                    <form action={deleteRuleFile}>
                      <input type="hidden" name="file_id" value={f.id} />
                      <input type="hidden" name="slug" value={slug} />
                      <button className="min-h-11 rounded-full px-3 text-sm font-medium text-accent-ink hover:bg-tint">
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
      </Panel>
    </div>
  );
}
