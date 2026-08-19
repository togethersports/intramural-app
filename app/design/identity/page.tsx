import type { Metadata } from "next";
import Link from "next/link";
import { AppearancePicker } from "@/components/appearance-picker";
import { IconCamera } from "@/components/icons";
import { Lockup } from "@/components/mark";
import { ThemeStyle } from "@/components/theme-style";
import { Avatar, Button, Panel, TeamBadge } from "@/components/ui";
import { positionsFor } from "@core/league-constants";
import { DEFAULT_APPEARANCE, type ThemePreset } from "@core/theme";

export const metadata: Metadata = { title: "Identity — design reference" };

/* The surfaces where people set who they are: a photo, a position, a team
   badge, a lineup, and the colour editor. Fixture data, no auth, no writes —
   the real forms live under /profile, /console and /team/[id]. */

const ROSTER = [
  { name: "Harry Stone", pos: "PG", num: "03", starter: true },
  { name: "Amir Katz", pos: "SG", num: "07", starter: true },
  { name: "Josh Meyer", pos: "SF", num: "11", starter: true },
  { name: "Ben Aronson", pos: "PF", num: "14", starter: true },
  { name: "Noah Field", pos: "C", num: "21", starter: true },
  { name: "Isaac Lowe", pos: "SG", num: "24", starter: false },
  { name: "Danny Reiss", pos: "", num: "32", starter: false },
];

export default async function IdentityReferencePage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string }>;
}) {
  const { preset } = await searchParams;
  const chosen: ThemePreset = preset === "sideline" ? "sideline" : "court";
  const options = positionsFor("basketball");
  const starters = ROSTER.filter((r) => r.starter).length;

  return (
    <>
      <ThemeStyle appearance={{ ...DEFAULT_APPEARANCE, preset: chosen }} />
      <div className="min-h-screen px-4 py-5 sm:px-6">
        <header className="mx-auto mb-5 flex w-full max-w-5xl flex-wrap items-center justify-between gap-3">
          <Link href="/design" aria-label="Design reference home">
            <Lockup size={32} tone="theme" />
          </Link>
          <div className="flex items-center gap-2">
            {(["court", "sideline"] as const).map((p) => (
              <Link
                key={p}
                href={`/design/identity?preset=${p}`}
                className={
                  chosen === p
                    ? "label rounded-full bg-ink px-4 py-2 !text-[10px] !text-on-ink"
                    : "label rounded-full bg-surface px-4 py-2 !text-[10px]"
                }
              >
                {p}
              </Link>
            ))}
          </div>
        </header>

        <div className="mx-auto w-full max-w-5xl space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel eyebrow="How you show up" title="Your photo">
              <div className="flex flex-wrap items-center gap-4">
                <Avatar name="Harry Stone" size={88} />
                <div className="space-y-2">
                  <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-[15px] font-semibold text-on-ink">
                    <IconCamera size={17} /> Add a photo
                  </span>
                  <p className="text-[13px] text-ink-body">
                    JPG, PNG, WebP or GIF, up to 4 MB.
                  </p>
                </div>
              </div>
            </Panel>

            <Panel eyebrow="Captain" title="Team card">
              <div className="flex flex-wrap items-center gap-4">
                <TeamBadge abbrev="PAN" color="#3E5C50" size={64} />
                <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-[15px] font-semibold text-on-ink">
                  <IconCamera size={17} /> Add a badge
                </span>
              </div>
            </Panel>
          </div>

          <Panel eyebrow="On the roster" title="Positions">
            <div className="flex flex-wrap gap-2">
              {options.map((p, i) => (
                <span
                  key={p.value}
                  className={
                    i < 2
                      ? "inline-flex min-h-11 items-center gap-2 rounded-full border border-accent bg-tint px-4 text-[15px] font-medium text-accent-ink"
                      : "inline-flex min-h-11 items-center gap-2 rounded-full border border-rule bg-paper px-4 text-[15px] font-medium"
                  }
                >
                  <span className="num text-[13px]">{p.value}</span>
                  <span>{p.label}</span>
                </span>
              ))}
            </div>
          </Panel>

          <Panel
            eyebrow="Captain"
            title="Lineup and reserves"
            action={
              <span className="num text-[15px] text-ink-body">
                {starters} starting · {ROSTER.length - starters} reserve
              </span>
            }
          >
            <ul className="space-y-2">
              {ROSTER.map((m) => (
                <li
                  key={m.name}
                  className={
                    m.starter
                      ? "flex flex-wrap items-center gap-3 rounded-panel border border-rule border-l-[3px] border-l-accent bg-paper px-3 py-2.5"
                      : "flex flex-wrap items-center gap-3 rounded-panel border border-rule bg-paper px-3 py-2.5 opacity-80"
                  }
                >
                  <span className="flex min-h-11 flex-1 items-center gap-3">
                    <Avatar name={m.name} size={32} />
                    <span className="min-w-0 truncate font-semibold">{m.name}</span>
                  </span>
                  <span className="num text-[15px] text-ink-body">#{m.num}</span>
                  <span className="num w-8 text-right text-[15px] text-ink-body">
                    {m.pos || "—"}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel eyebrow="Anyone" title="Colours">
            <AppearancePicker
              defaultPreset={chosen}
              defaultAccent={DEFAULT_APPEARANCE.accent}
            />
            <div className="mt-5">
              <Button type="button">Use these colours</Button>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
