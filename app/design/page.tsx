import type { Metadata } from "next";
import Link from "next/link";
import { CourtDiagram } from "@/components/court-diagram";
import { IconBall, IconChart, IconTrophy } from "@/components/icons";
import {
  Avatar,
  Button,
  EmptyState,
  Logo,
  Meter,
  RoleBadge,
  StatTile,
} from "@/components/ui";

export const metadata: Metadata = { title: "Design system" };

const swatches = [
  ["canvas", "#8399ac", "Page background"],
  ["canvas-deep", "#64798c", "Gradient edge"],
  ["surface", "#f4f4f1", "Cards"],
  ["surface-dim", "#e9eae4", "Nested panels"],
  ["ink", "#191c1f", "Text, dark buttons"],
  ["ink-soft", "#4e5860", "Secondary text"],
  ["accent", "#c8232c", "The data color"],
  ["accent-wash", "#f3e0de", "Meter tracks"],
  ["court", "#54749b", "Schematics"],
  ["sage", "#8fae7f", "Positive"],
  ["amber", "#dfa04f", "Caution"],
] as const;

export default function DesignPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4 text-white">
        <div>
          <Logo />
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            Design system
          </h1>
          <p className="mt-1 max-w-lg text-white/70">
            The Intramural look: off-white cards on a steel-blue canvas, one
            crimson accent, big radii, tabular stats. Full rules in{" "}
            <code className="rounded bg-white/15 px-1.5">docs/DESIGN.md</code>.
          </p>
        </div>
        <Link href="/" className="chip">
          ← Back to site
        </Link>
      </header>

      {/* Color */}
      <section className="card p-6">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Color</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {swatches.map(([name, hex, use]) => (
            <div key={name}>
              <div
                className="h-16 rounded-panel border border-ink/5"
                style={{ backgroundColor: hex }}
              />
              <p className="mt-1.5 text-sm font-semibold">{name}</p>
              <p className="text-xs text-ink-faint">
                {hex} · {use}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Type + buttons */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card space-y-3 p-6">
          <h2 className="text-lg font-semibold tracking-tight">Type</h2>
          <p className="text-4xl font-semibold tracking-tight">
            Headline / Instrument Sans
          </p>
          <p className="text-lg text-ink-soft">
            Body copy — readable, roomy, never gray-on-gray.
          </p>
          <p className="stat-num text-5xl">128 · 42.7 · 68%</p>
          <p className="text-[13px] font-medium text-ink-soft">
            Label · 13px medium ink-soft
          </p>
        </section>

        <section className="card space-y-4 p-6">
          <h2 className="text-lg font-semibold tracking-tight">Actions</h2>
          <div className="flex flex-wrap gap-2">
            <Button>Primary</Button>
            <Button variant="accent">Accent</Button>
            <Button variant="soft">Soft</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <RoleBadge role="commissioner" />
            <RoleBadge role="admin" />
            <RoleBadge role="captain" />
            <RoleBadge role="player" />
            <RoleBadge role="spectator" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Avatar name="Jordan Cohen" />
            <Avatar name="Maya Levy" />
            <Avatar name="Sam Katz" size={32} />
          </div>
        </section>
      </div>

      {/* Data display primitives — sample values, labeled as such */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight text-white">
          Data display primitives{" "}
          <span className="text-sm font-normal text-white/60">
            (sample values — real compositions live in the app)
          </span>
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Stat tile" value="128" icon={<IconTrophy size={16} />}>
            <p className="text-xs text-ink-faint">label · numeral · caption</p>
          </StatTile>
          <StatTile label="With meter" value="68%" icon={<IconChart size={16} />}>
            <Meter value={68} max={100} className="mt-1" />
          </StatTile>
          <div className="card grid place-items-center p-4 lg:col-span-2">
            <CourtDiagram className="max-h-48" />
          </div>
        </div>
        <div className="card max-w-md p-6">
          <h3 className="mb-3 font-semibold tracking-tight">Empty state</h3>
          <EmptyState
            icon={<IconBall size={26} />}
            title="No games scheduled"
            body="Every empty state says what fills it and who acts."
            action={<Button variant="soft">Primary recovery action</Button>}
          />
        </div>
      </section>
    </div>
  );
}
