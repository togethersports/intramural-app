import Link from "next/link";
import CourtHero from "@/components/court-hero";
import SeasonRail from "@/components/season-rail";
import {
  DraftBoardClock,
  LiveScoreCell,
  OnClockCell,
} from "@/components/landing-live";
import { Lockup, Mark } from "@/components/mark";
import { ButtonLink } from "@/components/ui";
import { getUser } from "@/lib/auth";

/* Staggered entrance delays, typed once. */
const delay = (s: number) => ({ "--lp-delay": `${s}s` }) as React.CSSProperties;

const TICKER = [
  "Warriors 42 · Hawks 38 — Final",
  "Carter 31 PTS · 9 REB",
  "Trade accepted: Brooks to Titans",
  "Free 6 · Gym 2 moved to half-court",
  "Suns clinch the 2 seed",
  "Playoffs seed Friday",
];

const PICKS = [
  ["1.01", "J. Carter", "Warriors"],
  ["1.02", "M. Brooks", "Titans"],
  ["1.03", "S. Reed", "Hawks"],
  ["1.04", "R. Hayes", "Suns"],
  ["1.05", "D. Miller", "Bolts"],
];

export default async function LandingPage() {
  const user = await getUser();
  const startHref = user ? "/leagues/new" : "/signup";
  const joinHref = user ? "/join" : "/login";

  return (
    <div className="overflow-x-clip">
      {/* Nav — sticky, blurred Court Blue */}
      <header className="sticky top-0 z-40 border-b border-white/25 bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <Link href="/" aria-label="Intramural home" className="shrink-0">
            <Mark size={34} tone="white-red" className="sm:hidden" />
            <Lockup size={36} tone="white-red" className="hidden sm:inline-flex" />
          </Link>
          <nav className="flex shrink-0 items-center gap-2 md:gap-6">
            <div className="label hidden items-center gap-6 !text-white/85 md:flex">
              <a href="#season" className="lp-link hover:text-white">
                Season
              </a>
              <a href="#board" className="lp-link hover:text-white">
                Draft
              </a>
              <a href="#start" className="lp-link hover:text-white">
                Start
              </a>
            </div>
            {user ? (
              <ButtonLink
                href="/dashboard"
                variant="light"
                className="whitespace-nowrap !px-5"
              >
                Open dashboard
              </ButtonLink>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-[17px] font-medium text-white sm:hidden"
                >
                  Sign in
                </Link>
                <span className="hidden sm:inline-flex">
                  <ButtonLink
                    href="/login"
                    variant="canvas"
                    className="whitespace-nowrap"
                  >
                    Sign in
                  </ButtonLink>
                </span>
                <ButtonLink
                  href="/signup"
                  variant="light"
                  className="whitespace-nowrap !px-5"
                >
                  Get started
                </ButtonLink>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero — the clipboard tumbles over the RUN YOUR LEAGUE marquee */}
      <h1 className="sr-only">Intramural — Run Your League</h1>
      <CourtHero startHref={startHref} joinHref={joinHref} />

      <section className="relative px-4 sm:px-6">
        <div className="relative mx-auto w-full max-w-7xl">
          {/* Docked scoreboard — first thing after the hero releases */}
          <div
            className="lp-dock relative mx-auto mt-14 grid max-w-6xl grid-cols-2 gap-px overflow-hidden rounded-t-card bg-ink/10 shadow-float lg:grid-cols-4"
            style={delay(0.15)}
          >
            <div className="bg-surface p-5 sm:p-6">
              <LiveScoreCell />
            </div>
            <div className="bg-surface p-5 sm:p-6">
              <p className="label !text-[11px]">Next slot</p>
              <p className="mt-2.5 text-[19px] font-medium text-ink sm:text-[22px]">
                Lunch A · Gym 1
              </p>
              <p className="mt-1 text-[13px] text-ink-muted">Titans vs Suns</p>
            </div>
            <div className="bg-surface p-5 sm:p-6">
              <OnClockCell />
            </div>
            <div className="bg-surface p-5 sm:p-6">
              <p className="label !text-[11px]">Season</p>
              <p className="num mt-2.5 text-[19px] text-ink sm:text-[22px]">
                Week 4 of 9
              </p>
              <p className="mt-1 text-[13px] text-ink-muted">
                Playoffs seed Friday
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Ticker — the league wire */}
      <div className="overflow-hidden bg-ink py-3.5">
        <div className="lp-ticker flex w-max">
          {[false, true].map((clone) => (
            <div
              key={String(clone)}
              aria-hidden={clone}
              className="label flex items-center gap-10 pr-10 whitespace-nowrap !text-[12.5px] !tracking-[0.22em] !text-surface"
            >
              {TICKER.map((t) => (
                <span key={t} className="flex items-center gap-10">
                  {t}
                  <span aria-hidden className="text-accent">
                    ◆
                  </span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Features — the pinned season rail */}
      <SeasonRail />

      {/* Draft board — the dark panel */}
      <section id="board" className="px-4 pb-20 sm:px-6 sm:pb-24">
        <div className="lp-reveal mx-auto grid w-full max-w-7xl overflow-hidden rounded-card bg-ink text-surface lg:grid-cols-[1.15fr_1fr]">
          <div className="p-8 sm:p-11">
            <p className="label !text-blush">The board · Round 1</p>
            <h3 className="mt-4 max-w-[20ch] text-[clamp(26px,2.6vw,38px)] font-semibold leading-[1.05] tracking-[-0.03em] text-white">
              Draft night, on a phone, between classes.
            </h3>
            <div className="num mt-7 divide-y divide-white/15 text-[15px]">
              {PICKS.map(([no, name, team]) => (
                <div
                  key={no}
                  className="grid grid-cols-[56px_1fr_auto] items-center gap-3.5 py-3.5"
                >
                  <span className="text-white/45">{no}</span>
                  <span className="font-medium text-white">{name}</span>
                  <span className="text-white/60">{team}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-accent">
            <DraftBoardClock />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="start" className="px-4 pb-20 sm:px-6 sm:pb-24">
        <div className="card lp-reveal mx-auto w-full max-w-7xl p-10 text-center sm:p-16 lg:p-20">
          <p className="label !text-accent">Free for schools</p>
          <h2 className="mx-auto mt-5 max-w-[18ch] text-[clamp(32px,5vw,68px)] font-semibold leading-[0.98] tracking-[-0.035em]">
            Zero to drafted-and-scheduled in under 20 minutes.
          </h2>
          <p className="mx-auto mt-5 max-w-[44ch] text-[18px] leading-[1.5] text-ink-body">
            Players join with a six-character code. No spreadsheets, no group
            chats, no arguments about who really won.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink href={startHref} variant="accent">
              Start a league
            </ButtonLink>
            <ButtonLink href={joinHref} variant="light">
              I have a join code
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/25 px-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-6 py-10">
          <Lockup size={32} tone="white-red" />
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[17px] font-medium text-white">
            <Link href="/login" className="hover:text-white/70">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-white/70">
              Create account
            </Link>
            <Link href="/design" className="hover:text-white/70">
              Brand
            </Link>
            <Link href="/privacy" className="hover:text-white/70">
              Privacy
            </Link>
            <Link href="/support" className="hover:text-white/70">
              Support
            </Link>
          </nav>
          <p className="label !text-white/70">
            Built for lunch periods everywhere
          </p>
        </div>
      </footer>
    </div>
  );
}
