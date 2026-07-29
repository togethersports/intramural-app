import type { Metadata } from "next";
import Link from "next/link";
import { CourtDiagram } from "@/components/court-diagram";
import { Lockup, Mark } from "@/components/mark";
import {
  Avatar,
  Button,
  EmptyState,
  Meter,
  RoleBadge,
  StatTile,
  TeamBadge,
} from "@/components/ui";

export const metadata: Metadata = { title: "Brand" };

const core = [
  ["Night Court", "#17171A", "Text, dark panels", "72 66 61 71 · PMS Black 6 C"],
  ["Whistle Red", "#C9242C", "The one action", "12 100 96 3 · PMS 1795 C"],
  ["Court Blue", "#8FA6BF", "The ground", "43 26 15 0 · PMS 5435 C"],
  ["Sideline Cream", "#F1EFE8", "Cards, paper", "4 3 7 0 · PMS 7527 C"],
] as const;

const support = [
  ["Bench Blue", "#4E7CA8", "Slot chips, tags"],
  ["Red Tint", "#F7DCDC", "Active rows, tracks"],
  ["Paper White", "#FFFFFF", "Nested rows"],
] as const;

export default function BrandPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Lockup size={40} tone="white-red" />
          <h1 className="mt-5 text-[52px] font-semibold leading-[0.94] tracking-[-0.035em] text-white">
            Brand in code.
          </h1>
          <p className="mt-3 max-w-[62ch] text-[17px] font-medium leading-relaxed text-white">
            Every token, component, and rule below is what the app actually
            ships. Written rules live in{" "}
            <code className="num rounded bg-white/22 px-1.5 py-0.5 text-[15px]">
              docs/DESIGN.md
            </code>
            .
          </p>
        </div>
        <Link href="/" className="chip-canvas">
          Back to site
        </Link>
      </header>

      {/* The mark */}
      <section className="card p-8">
        <p className="label">01 — The mark</p>
        <h2 className="mt-3 text-[36px] font-semibold leading-[1.05] tracking-[-0.025em]">
          The Bracket
        </h2>
        <p className="mt-3 max-w-[62ch] text-[17px] leading-[1.55] text-ink-body">
          Two seeds feed a matchup; one line comes out the other side in
          Whistle Red. It reads as a bracket, a schedule, and a decision at
          once — and it is the only place red appears in the identity by
          default.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          <div className="grid place-items-center rounded-panel bg-ink py-10">
            <Mark size={72} tone="white-red" />
          </div>
          <div className="grid place-items-center rounded-panel bg-canvas py-10">
            <Mark size={72} tone="white" />
          </div>
          <div className="grid place-items-center rounded-panel bg-paper py-10">
            <Mark size={72} tone="ink" />
          </div>
          <div className="grid place-items-center rounded-panel bg-accent py-10">
            <Mark size={72} tone="white" />
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {[
            ["Grid", "64 × 64 units. Inputs y18 / y46, output y32."],
            ["Stroke", "6 units, round caps. Never re-weight by eye."],
            ["Clearspace", "28 units — the connector height — all sides."],
            ["Minimum", "20 px on screen. Below that, drop the red line."],
          ].map(([k, v]) => (
            <div key={k} className="rounded-panel bg-paper p-5">
              <p className="label">{k}</p>
              <p className="mt-2 text-[16px] leading-[1.45]">{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-6 rounded-panel bg-paper p-6">
          <Lockup size={48} />
          <Lockup size={32} />
          <Mark size={20} />
          <p className="label ml-auto">
            Lockup: text 0.53× mark, gap 0.28×
          </p>
        </div>
      </section>

      {/* Colour */}
      <section className="card p-8">
        <p className="label">02 — Colour</p>
        <h2 className="mt-3 text-[36px] font-semibold leading-[1.05] tracking-[-0.025em]">
          Court blue, cream paper, one red
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {core.map(([name, hex, use, print]) => (
            <div key={name} className="overflow-hidden rounded-panel bg-paper">
              <div className="h-28" style={{ backgroundColor: hex }} />
              <div className="p-5">
                <p className="text-[19px] font-semibold">{name}</p>
                <p className="num mt-1.5 text-[13px] leading-[1.7] text-ink-muted">
                  {hex}
                  <br />
                  {use}
                  <br />
                  {print}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {support.map(([name, hex, use]) => (
            <div
              key={name}
              className="flex items-center gap-4 rounded-panel bg-paper p-5"
            >
              <span
                className="size-13 shrink-0 rounded-[12px] border border-rule"
                style={{ backgroundColor: hex, width: 52, height: 52 }}
              />
              <div>
                <p className="text-[18px] font-semibold">{name}</p>
                <p className="num text-[13px] text-ink-muted">
                  {hex} · {use}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-6 rounded-panel bg-paper p-6 sm:grid-cols-3">
          <div>
            <p className="label !text-accent">Ratio</p>
            <p className="mt-2 text-[16px] leading-[1.5] text-ink-body">
              60% Court Blue · 30% cream and white · 8% Night Court · 2%
              Whistle Red. Two background colours per surface, maximum.
            </p>
          </div>
          <div>
            <p className="label !text-accent">Contrast</p>
            <p className="mt-2 text-[16px] leading-[1.5] text-ink-body">
              Text on Court Blue is white at 500 or heavier. Never Night Court
              body copy on Court Blue.
            </p>
          </div>
          <div>
            <p className="label !text-accent">School colours</p>
            <p className="mt-2 text-[16px] leading-[1.5] text-ink-body">
              Team colours live inside team badges and bracket rows only —
              never on Intramural chrome or buttons.
            </p>
          </div>
        </div>
      </section>

      {/* Typography */}
      <section className="card p-8">
        <p className="label">03 — Typography</p>
        <h2 className="mt-3 text-[36px] font-semibold leading-[1.05] tracking-[-0.025em]">
          Outfit for anything human, mono for anything counted
        </h2>
        <div className="mt-6 space-y-4 rounded-panel bg-paper p-6">
          {[
            ["Display", "72/0.94/600", <span key="d" className="text-[44px] font-semibold leading-[0.94] tracking-[-0.035em]">Run your league like the pros.</span>],
            ["Heading", "36/1.05/600", <span key="h" className="text-[32px] font-semibold leading-[1.05] tracking-[-0.025em]">Everything a season needs</span>],
            ["Body", "17/1.55/400", <span key="b" className="block max-w-[62ch] text-[17px] leading-[1.55] text-ink-body">Games go into named slots — Lunch A, Free Period 6, After School — matched to when both teams actually have players free. Body copy never exceeds 62 characters a line.</span>],
          ].map(([label, spec, sample]) => (
            <div
              key={label as string}
              className="grid items-baseline gap-6 border-b border-rule pb-4 last:border-0 sm:grid-cols-[150px_1fr]"
            >
              <p className="label whitespace-pre-line">{`${label}\n${spec}`}</p>
              {sample as React.ReactNode}
            </div>
          ))}
          <div className="grid items-center gap-6 sm:grid-cols-[150px_1fr]">
            <p className="label whitespace-pre-line">
              {"Data\nJetBrains Mono\n13/0.16em/500"}
            </p>
            <div className="flex flex-wrap items-center gap-9">
              <span className="label">Standings · Q4 2:14 · Pick 1.03</span>
              <span className="num text-[28px]">78 64 51</span>
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-panel bg-ink p-6">
            <p className="text-[20px] font-semibold text-white">Rules</p>
            <ul className="mt-3 space-y-1.5 text-[15px] leading-[1.7] text-white/75">
              <li>Weights 400, 500, 600 only — no 700, no italics</li>
              <li>Tighten tracking as size grows; never track out headlines</li>
              <li>Sentence case everywhere except mono labels</li>
              <li>Headlines take a period when they state something</li>
            </ul>
          </div>
          <div className="rounded-panel bg-paper p-6">
            <p className="text-[20px] font-semibold">Numbers</p>
            <p className="mt-3 max-w-[62ch] text-[16px] leading-[1.55] text-ink-body">
              Anything a student would argue about — scores, picks, clock,
              seeds, plus/minus — sets in JetBrains Mono, tabular. Everything
              else is Outfit. Never mix the two inside one word.
            </p>
          </div>
        </div>
      </section>

      {/* Components */}
      <section className="card p-8">
        <p className="label">04 — Components</p>
        <h2 className="mt-3 text-[36px] font-semibold leading-[1.05] tracking-[-0.025em]">
          Pills, rows, and one loud button
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-panel bg-paper p-6">
            <p className="label">Buttons — 999px radius, 14/24 padding</p>
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <Button variant="accent">Start a league</Button>
              <Button variant="primary">Get started</Button>
              <Button variant="quiet">I have a join code</Button>
            </div>
            <p className="mt-4 text-[15px] leading-[1.5] text-ink-muted">
              One red button per view. On Court Blue, secondary buttons become
              22% white fill with white text.
            </p>
          </div>

          <div className="rounded-panel bg-paper p-6">
            <p className="label">Chips — slots and stat actions</p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <span className="chip">Lunch A · Gym 1</span>
              <span className="chip">Free 6 · Gym 2</span>
              <span className="chip">3:30 · Half-court</span>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2.5">
              {["2PT", "3PT", "REB", "AST"].map((s) => (
                <span key={s} className="chip-stat !px-0">
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-panel bg-paper p-6">
            <p className="label">Rows — 12px radius, mono index left</p>
            <div className="mt-4 space-y-2">
              {[
                ["1.01", "J. Cohen", "Warriors", false],
                ["1.02", "M. Levy", "Titans", false],
                ["1.03", "On the clock…", "Hawks", true],
              ].map(([no, who, team, live]) => (
                <div
                  key={no as string}
                  className={`flex items-center justify-between rounded-row px-5 py-3.5 ${
                    live ? "bg-tint text-accent" : "bg-surface"
                  }`}
                >
                  <span className="num text-[14px] opacity-70">{no}</span>
                  <span className="text-[17px] font-medium">{who}</span>
                  <span className="text-[15px] opacity-70">{team}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-panel bg-paper p-6">
            <p className="label">Bars and geometry</p>
            <div className="mt-4 space-y-2.5">
              {[
                ["Cohen", 78],
                ["Levy", 64],
              ].map(([n, v]) => (
                <div key={n as string} className="flex items-center gap-4">
                  <span className="w-16 text-[16px]">{n}</span>
                  <Meter value={v as number} max={88} className="flex-1" />
                  <span className="num w-8 text-right text-[15px]">{v}</span>
                </div>
              ))}
            </div>
            <div className="num mt-5 grid grid-cols-3 gap-3 text-[13px] leading-[1.6] text-ink-muted">
              <p className="border-t border-rule-soft pt-2.5">
                Cards 18–24px
                <br />
                Rows 12–14px
                <br />
                Pills 999px
              </p>
              <p className="border-t border-rule-soft pt-2.5">
                Grid 8px
                <br />
                Card pad 24px
                <br />
                Section pad 96px
              </p>
              <p className="border-t border-rule-soft pt-2.5">
                Shadow only on
                <br />
                floating overlays
                <br />
                0 30px 80px / 18%
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-panel bg-paper p-6">
            <p className="label">Identity</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Avatar name="Jordan Cohen" />
              <Avatar name="Maya Levy" size={32} />
              <TeamBadge abbrev="WAR" color="#4E7CA8" size={36} />
              <TeamBadge abbrev="HWK" color="#C9242C" size={36} />
            </div>
            <p className="mt-3 text-[15px] leading-[1.5] text-ink-muted">
              Avatars are Night Court. Team colour appears only in the badge.
            </p>
          </div>
          <div className="rounded-panel bg-paper p-6">
            <p className="label">Roles</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <RoleBadge role="commissioner" />
              <RoleBadge role="admin" />
              <RoleBadge role="captain" />
              <RoleBadge role="player" />
            </div>
          </div>
          <StatTile label="Stat tile" value="128">
            <p className="text-[15px] text-ink-muted">
              Mono numeral, mono label
            </p>
          </StatTile>
        </div>
      </section>

      {/* Voice */}
      <section className="card p-8">
        <p className="label">05 — Voice</p>
        <h2 className="mt-3 text-[36px] font-semibold leading-[1.05] tracking-[-0.025em]">
          Sound like the best commissioner in the school
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-panel bg-paper p-7">
            <p className="label !text-accent">We write</p>
            <div className="mt-4 space-y-3.5 text-[18px] leading-[1.45]">
              <p>&ldquo;Zero to drafted-and-scheduled in under 20 minutes.&rdquo;</p>
              <p>&ldquo;Two taps per event, undo anything.&rdquo;</p>
              <p>&ldquo;Warriors send Cohen to Hawks for Levy and Katz.&rdquo;</p>
              <p>&ldquo;Gym 1 is taken at Lunch A. Pick another slot.&rdquo;</p>
            </div>
          </div>
          <div className="rounded-panel bg-ink p-7">
            <p className="label" style={{ color: "#F1A0A4" }}>
              We don&rsquo;t
            </p>
            <div className="mt-4 space-y-3.5 text-[18px] leading-[1.45] text-white/70">
              <p>&ldquo;Revolutionize your athletic engagement ecosystem.&rdquo;</p>
              <p>&ldquo;Let&rsquo;s get this bread&rdquo;</p>
              <p>&ldquo;Seamless, powerful, best-in-class scheduling.&rdquo;</p>
              <p>&ldquo;Oops! Something went wrong.&rdquo;</p>
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          {[
            ["Verbs first", "Start a league. Propose a trade. Lock the deadline."],
            ["Real nouns", "Gyms, periods, seeds, picks — not “resources”."],
            ["No emoji", "Ever. The stat chips carry the energy instead."],
            ["Errors name the fix", "Say what is wrong and what to do next."],
          ].map(([k, v]) => (
            <div key={k} className="rounded-panel bg-paper p-5">
              <p className="text-[19px] font-semibold">{k}</p>
              <p className="mt-2 text-[15px] leading-[1.5] text-ink-body">{v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Motif + empty state */}
      <section className="grid gap-5 lg:grid-cols-3">
        <div className="card grid place-items-center p-6">
          <CourtDiagram className="max-h-72" />
        </div>
        <div className="card p-8 lg:col-span-2">
          <p className="label">06 — Court motif and empty states</p>
          <p className="mt-3 max-w-[62ch] text-[17px] leading-[1.55] text-ink-body">
            Thin white court lines on Court Blue are the one decorative
            device: 2px strokes, true proportions, never rotated for effect.
          </p>
          <div className="mt-5">
            <EmptyState
              title="No games scheduled"
              body="Every empty state names what fills it and who acts next."
              action={<Button variant="quiet">Open schedule builder</Button>}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
