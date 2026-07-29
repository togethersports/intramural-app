import Link from "next/link";
import { CourtDiagram } from "@/components/court-diagram";
import { Lockup } from "@/components/mark";
import { ButtonLink, Meter } from "@/components/ui";
import { getUser } from "@/lib/auth";

export default async function LandingPage() {
  const user = await getUser();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
      {/* Nav */}
      <header className="flex items-center justify-between py-6">
        <Lockup size={38} tone="white-red" />
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
      <section className="grid items-center gap-10 py-10 sm:py-14 lg:grid-cols-2">
        <div>
          <p className="label !text-white/85">School intramural sports</p>
          <h1 className="mt-5 text-[52px] font-semibold leading-[0.94] tracking-[-0.035em] text-white sm:text-[72px]">
            Intramural —
            <br />
            Run Your League
          </h1>
          <p className="mt-6 max-w-[46ch] text-[19px] font-medium leading-[1.5] text-white">
            Captains draft teams. Games fit into lunch and free periods. Stats
            are tracked live from the sideline. Playoffs settle it.
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            {["Lunch A · Gym 1", "Free 6 · Gym 2", "3:30 · Half-court"].map(
              (t) => (
                <span key={t} className="chip">
                  {t}
                </span>
              ),
            )}
          </div>
          <div className="mt-9 flex flex-wrap gap-3">
            <ButtonLink
              href={user ? "/leagues/new" : "/signup"}
              variant="accent"
            >
              Start a league
            </ButtonLink>
            <ButtonLink href={user ? "/join" : "/login"} variant="canvas">
              I have a join code
            </ButtonLink>
          </div>
        </div>

        {/* Court motif with floating cards — shadow lives on overlays only */}
        <div className="relative mx-auto w-[240px]">
          <CourtDiagram className="h-[448px] w-full" />
          <div className="card-float absolute -left-16 top-10 flex items-center gap-3 px-5 py-4 sm:-left-24">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
            </span>
            <div>
              <p className="num text-[17px]">Warriors 42 · Hawks 38</p>
              <p className="label !text-[11px]">Q4 · 2:14</p>
            </div>
          </div>
          <div className="card-float absolute -right-14 bottom-12 px-5 py-4 sm:-right-20">
            <p className="label !text-[11px]">Pick 1.12 · Titans</p>
            <p className="mt-1 text-[17px] font-medium">Maya Levy</p>
            <Meter value={42} max={60} className="mt-2 w-28" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-14">
        <h2 className="mb-8 text-[36px] font-semibold leading-[1.05] tracking-[-0.025em] text-white">
          Everything a season needs
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Feature
            eyebrow="Draft"
            title="A real draft room"
            body="Snake or linear, pick timer, auto-pick from your queue, live rosters filling in. Fully usable from a phone in the hallway."
          >
            <div className="space-y-2">
              {[
                ["1.01", "J. Cohen", "Warriors", false],
                ["1.02", "M. Levy", "Titans", false],
                ["1.03", "On the clock…", "Hawks", true],
              ].map(([no, player, team, live]) => (
                <div
                  key={no as string}
                  className={`flex items-center justify-between rounded-row px-4 py-3 ${
                    live ? "bg-tint text-accent" : "bg-paper"
                  }`}
                >
                  <span className="num text-[14px] opacity-70">{no}</span>
                  <span className="text-[17px] font-medium">{player}</span>
                  <span className="text-[15px] opacity-70">{team}</span>
                </div>
              ))}
            </div>
          </Feature>

          <Feature
            eyebrow="Scheduling"
            title="Scheduling that knows school"
            body="Games go into named slots — Lunch A, Free Period 6, After School — matched to when both teams actually have players free."
          >
            <div className="flex flex-wrap gap-2">
              {["Lunch A · Gym 1", "Free 6 · Gym 2", "3:30 · Half-court"].map(
                (s) => (
                  <span key={s} className="chip !py-2 !text-[14px]">
                    {s}
                  </span>
                ),
              )}
            </div>
          </Feature>

          <Feature
            eyebrow="Live stats"
            title="Courtside stat tracking"
            body="Two taps per event, undo anything. Works offline on gym Wi-Fi and syncs when you're back. Plus/minus computes itself."
          >
            <div className="grid grid-cols-4 gap-2">
              {["2PT", "3PT", "REB", "AST", "STL", "BLK", "TO", "PF"].map(
                (e) => (
                  <span key={e} className="chip-stat !px-0 !text-[13px]">
                    {e}
                  </span>
                ),
              )}
            </div>
          </Feature>

          <Feature
            eyebrow="Leaders"
            title="Stats worth arguing about"
            body="Box scores, shooting splits, leaderboards, per-game averages, career totals across seasons — updated the moment a game goes final."
          >
            <div className="space-y-3">
              {[
                ["Cohen", 78],
                ["Levy", 64],
                ["Katz", 51],
              ].map(([name, v]) => (
                <div key={name as string} className="flex items-center gap-4">
                  <span className="w-14 text-[16px]">{name}</span>
                  <Meter value={v as number} max={80} className="flex-1" />
                  <span className="num w-8 text-right text-[15px]">{v}</span>
                </div>
              ))}
            </div>
          </Feature>

          <Feature
            eyebrow="Trades"
            title="Trades with receipts"
            body="Propose, counter, accept — commissioner approval or league vote, a deadline that locks it all, and a public transaction log."
          >
            <p className="rounded-row bg-paper px-4 py-3 text-[16px] leading-relaxed">
              <span className="label !text-accent">Trade</span>
              <br />
              Warriors send Cohen to Hawks for Levy and Katz.
            </p>
          </Feature>

          <Feature
            eyebrow="Playoffs"
            title="Playoffs and a trophy"
            body="Seeding from standings with real tiebreakers, live brackets that auto-advance, MVP and season awards at the end."
          >
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-2">
                <div className="rounded-row bg-paper px-3 py-2 text-[15px] font-medium">
                  <span className="num mr-2 text-ink-faint">1</span>Warriors
                </div>
                <div className="rounded-row bg-paper px-3 py-2 text-[15px] font-medium">
                  <span className="num mr-2 text-ink-faint">4</span>Titans
                </div>
              </div>
              <div className="h-px w-4 bg-accent" />
              <div className="flex-1 rounded-row bg-tint px-3 py-2 text-[15px] font-medium text-accent">
                Championship
              </div>
            </div>
          </Feature>
        </div>
      </section>

      {/* CTA band */}
      <section className="py-8">
        <div className="flex flex-col items-start justify-between gap-8 rounded-card bg-ink p-10 sm:flex-row sm:items-center sm:p-14">
          <div>
            <h2 className="text-[36px] font-semibold leading-[1.05] tracking-[-0.025em] text-white">
              Zero to drafted-and-scheduled
              <br className="hidden sm:block" /> in under 20 minutes.
            </h2>
            <p className="mt-3 max-w-[52ch] text-[17px] leading-relaxed text-white/70">
              Free for schools. Players join with a six-character code.
            </p>
          </div>
          <ButtonLink href={user ? "/leagues/new" : "/signup"} variant="accent">
            Start a league
          </ButtonLink>
        </div>
      </section>

      {/* Footer */}
      <footer className="flex flex-wrap items-center justify-between gap-6 py-12">
        <Lockup size={32} tone="white-red" />
        <nav className="flex gap-6 text-[17px] font-medium text-white">
          <Link href="/login" className="hover:text-white/70">
            Sign in
          </Link>
          <Link href="/signup" className="hover:text-white/70">
            Create account
          </Link>
          <Link href="/design" className="hover:text-white/70">
            Brand
          </Link>
        </nav>
        <p className="label !text-white/70">Built for lunch periods everywhere</p>
      </footer>
    </div>
  );
}

function Feature({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <article className="card flex flex-col gap-4 p-7">
      <div>
        <p className="label !text-accent">{eyebrow}</p>
        <h3 className="mt-3 text-[22px] font-semibold leading-tight tracking-[-0.02em]">
          {title}
        </h3>
      </div>
      <p className="max-w-[62ch] text-[17px] leading-[1.55] text-ink-body">
        {body}
      </p>
      {children ? <div className="mt-auto">{children}</div> : null}
    </article>
  );
}
