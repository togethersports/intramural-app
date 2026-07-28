import Link from "next/link";
import { CourtDiagram } from "@/components/court-diagram";
import {
  IconBall,
  IconCalendar,
  IconChart,
  IconTrophy,
  IconUsers,
  IconWhistle,
} from "@/components/icons";
import { ButtonLink, Logo, Meter } from "@/components/ui";
import { getUser } from "@/lib/auth";

export default async function LandingPage() {
  const user = await getUser();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
      {/* Nav */}
      <header className="flex items-center justify-between py-5 text-white">
        <Logo />
        <nav className="flex items-center gap-2">
          {user ? (
            <ButtonLink href="/dashboard" variant="light">
              Open dashboard
            </ButtonLink>
          ) : (
            <>
              <ButtonLink href="/login" variant="canvas">
                Sign in
              </ButtonLink>
              <ButtonLink href="/signup" variant="light">
                Get started
              </ButtonLink>
            </>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section className="grid items-center gap-10 py-10 sm:py-16 lg:grid-cols-2">
        <div className="text-white">
          <p className="chip">School intramural sports, upgraded</p>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Run your league
            <br />
            like the pros.
          </h1>
          <p className="mt-5 max-w-md text-lg text-white/80">
            Captains draft teams. Games fit into lunch and free periods. Stats
            are tracked live from the sideline. Playoffs settle it.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {["Draft day", "Lunch-slot scheduling", "Live stats", "Playoffs"].map(
              (t) => (
                <span key={t} className="chip">
                  {t}
                </span>
              ),
            )}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink
              href={user ? "/leagues/new" : "/signup"}
              variant="light"
              className="px-7 text-base"
            >
              Start a league
            </ButtonLink>
            <ButtonLink href={user ? "/join" : "/login"} variant="canvas">
              I have a join code
            </ButtonLink>
          </div>
        </div>

        {/* Court schematic with floating game cards */}
        <div className="relative mx-auto w-full max-w-sm">
          <CourtDiagram className="w-full drop-shadow-2xl" />
          <div className="card absolute -left-4 top-10 flex items-center gap-3 p-4 sm:-left-12">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
            </span>
            <div className="tabular text-sm font-semibold">
              Warriors 42 · Hawks 38
              <p className="text-xs font-medium text-ink-soft">Q4 · 2:14</p>
            </div>
          </div>
          <div className="card absolute -right-2 bottom-16 p-4 sm:-right-10">
            <p className="text-xs font-medium text-ink-soft">Pick 12 · Titans</p>
            <p className="text-sm font-semibold">Maya Levy</p>
            <Meter value={42} max={60} className="mt-2 w-28" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-10">
        <h2 className="mb-6 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Everything a season needs
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Feature
            icon={<IconUsers size={20} />}
            title="A real draft room"
            body="Snake or linear, pick timer, auto-pick from your queue, live rosters filling in. Fully usable from a phone in the hallway."
          >
            <div className="space-y-2">
              {[
                ["1.01", "J. Cohen", "Warriors"],
                ["1.02", "M. Levy", "Titans"],
                ["1.03", "On the clock…", "Hawks"],
              ].map(([no, player, team], i) => (
                <div
                  key={no}
                  className={`flex items-center justify-between rounded-control px-3 py-2 text-sm ${
                    i === 2
                      ? "bg-accent-wash font-semibold text-accent-deep"
                      : "bg-surface-dim/70"
                  }`}
                >
                  <span className="tabular text-xs text-ink-faint">{no}</span>
                  <span className="font-medium">{player}</span>
                  <span className="text-xs text-ink-soft">{team}</span>
                </div>
              ))}
            </div>
          </Feature>

          <Feature
            icon={<IconCalendar size={20} />}
            title="Scheduling that knows school"
            body="Games go into named slots — Lunch A, Free Period 6, After School — matched to when both teams actually have players free."
          >
            <div className="flex flex-wrap gap-1.5">
              {["Lunch A · Gym 1", "Free 6 · Gym 2", "3:30 · Half-court"].map(
                (s) => (
                  <span
                    key={s}
                    className="rounded-full bg-court px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    {s}
                  </span>
                ),
              )}
            </div>
          </Feature>

          <Feature
            icon={<IconWhistle size={20} />}
            title="Courtside stat tracking"
            body="Two taps per event, undo anything, works offline on gym Wi-Fi and syncs when you're back. Plus/minus computes itself."
          >
            <div className="grid grid-cols-4 gap-1.5">
              {["2PT", "3PT", "REB", "AST", "STL", "BLK", "TO", "FOUL"].map(
                (e) => (
                  <span
                    key={e}
                    className="rounded-control bg-ink py-2 text-center text-xs font-bold text-surface"
                  >
                    {e}
                  </span>
                ),
              )}
            </div>
          </Feature>

          <Feature
            icon={<IconChart size={20} />}
            title="Stats worth arguing about"
            body="Box scores, shooting splits, leaderboards, per-game averages, career totals across seasons — updated the moment a game goes final."
          >
            <div className="space-y-2.5">
              {[
                ["Cohen", 78],
                ["Levy", 64],
                ["Katz", 51],
              ].map(([name, v]) => (
                <div key={name as string} className="flex items-center gap-3">
                  <span className="w-12 text-xs font-semibold">{name}</span>
                  <Meter value={v as number} max={80} className="flex-1" />
                  <span className="tabular text-xs text-ink-soft">{v}</span>
                </div>
              ))}
            </div>
          </Feature>

          <Feature
            icon={<IconUsers size={20} />}
            title="Trades with receipts"
            body="Propose, counter, accept — commissioner approval or league vote, a deadline that locks it all, and a public transaction log."
          >
            <p className="rounded-control bg-surface-dim/70 px-3 py-2.5 text-xs font-medium text-ink-soft">
              <span className="font-bold text-accent-deep">TRADE:</span>{" "}
              Warriors send Cohen to Hawks for Levy and Katz.
            </p>
          </Feature>

          <Feature
            icon={<IconTrophy size={20} />}
            title="Playoffs and a trophy"
            body="Seeding from standings with real tiebreakers, live brackets that auto-advance, MVP and season awards at the end."
          >
            <div className="flex items-center gap-2 text-xs font-semibold">
              <div className="flex-1 space-y-1.5">
                <div className="rounded-control bg-surface-dim/70 px-2.5 py-1.5">
                  (1) Warriors
                </div>
                <div className="rounded-control bg-surface-dim/70 px-2.5 py-1.5">
                  (4) Titans
                </div>
              </div>
              <div className="text-ink-faint">→</div>
              <div className="flex-1 rounded-control bg-accent-wash px-2.5 py-1.5 text-accent-deep">
                Championship
              </div>
            </div>
          </Feature>
        </div>
      </section>

      {/* CTA band */}
      <section className="py-10">
        <div className="flex flex-col items-start justify-between gap-6 rounded-card bg-ink p-8 text-surface shadow-card sm:flex-row sm:items-center sm:p-10">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Zero to drafted-and-scheduled
              <br className="hidden sm:block" /> in under 20 minutes.
            </h2>
            <p className="mt-2 text-surface/70">
              Free for schools. Players join with a 6-character code.
            </p>
          </div>
          <ButtonLink
            href={user ? "/leagues/new" : "/signup"}
            variant="accent"
            className="px-7 text-base"
          >
            <IconBall size={20} /> Start a league
          </ButtonLink>
        </div>
      </section>

      {/* Footer */}
      <footer className="flex flex-wrap items-center justify-between gap-4 py-10 text-sm text-white/70">
        <Logo className="text-white" />
        <nav className="flex gap-5">
          <Link href="/login" className="hover:text-white">
            Sign in
          </Link>
          <Link href="/signup" className="hover:text-white">
            Create account
          </Link>
          <Link href="/design" className="hover:text-white">
            Design system
          </Link>
        </nav>
        <p>Built for lunch periods everywhere.</p>
      </footer>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <article className="card flex flex-col gap-4 p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-[12px] bg-surface-dim text-ink">
          {icon}
        </span>
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      </div>
      <p className="text-sm leading-relaxed text-ink-soft">{body}</p>
      {children ? <div className="mt-auto">{children}</div> : null}
    </article>
  );
}
