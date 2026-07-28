import type { Metadata } from "next";
import Link from "next/link";
import { CourtDiagram } from "@/components/court-diagram";
import {
  IconBall,
  IconChart,
  IconTrophy,
  IconUsers,
  IconWhistle,
} from "@/components/icons";
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

      {/* Dashboard composition — the inspo layout in our system */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight text-white">
          Composition — stat tiles and meters
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile
            label="Total teams"
            value="8"
            icon={<IconTrophy size={16} />}
          />
          <StatTile
            label="Registered"
            value="96"
            icon={<IconUsers size={16} />}
          >
            <p className="text-xs text-ink-faint">players this season</p>
          </StatTile>
          <StatTile
            label="Season progress"
            value="68%"
            icon={<IconChart size={16} />}
          >
            <Meter value={68} max={100} className="mt-1" />
          </StatTile>
          <StatTile
            label="Games this week"
            value="12"
            icon={<IconWhistle size={16} />}
          >
            <p className="text-xs text-ink-faint">across 3 venues</p>
          </StatTile>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card p-6 lg:col-span-2">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-semibold tracking-tight">Most active teams</h3>
              <span className="text-xs text-ink-faint">
                teams with the most games
              </span>
            </div>
            <div className="mt-4 space-y-4">
              {[
                ["Thunder FC", 28],
                ["Phoenix United", 26],
                ["Titan Sports", 24],
                ["Storm Warriors", 22],
              ].map(([team, games]) => (
                <div key={team as string} className="flex items-center gap-4">
                  <span className="w-32 truncate text-sm font-semibold">
                    {team}
                  </span>
                  <Meter value={games as number} max={30} className="flex-1" />
                  <span className="tabular w-6 text-right text-sm font-semibold">
                    {games}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="card grid place-items-center p-6">
            <CourtDiagram className="max-h-72" />
          </div>
        </div>

        <div className="card max-w-md p-6">
          <h3 className="mb-3 font-semibold tracking-tight">Empty state</h3>
          <EmptyState
            icon={<IconBall size={26} />}
            title="No games scheduled"
            body="Auto-generate a schedule or drag matchups into slots."
            action={<Button variant="soft">Open schedule builder</Button>}
          />
        </div>
      </section>
    </div>
  );
}
