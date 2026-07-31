import Link from "next/link";
import CourtHero from "@/components/court-hero";
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
      <CourtHero />

      <section className="relative px-4 sm:px-6">
        <div className="relative mx-auto w-full max-w-7xl">
          <p
            className="lp-rise mx-auto mt-10 max-w-[52ch] text-center text-[clamp(17px,1.5vw,20px)] font-medium leading-[1.5] text-white"
            style={delay(0.1)}
          >
            Captains draft teams. Games fit into lunch and free periods. Stats
            are tracked live from the sideline. Playoffs settle it.
          </p>

          <div
            className="lp-rise mt-8 flex flex-wrap justify-center gap-3"
            style={delay(0.22)}
          >
            <ButtonLink href={startHref} variant="accent">
              Start a league
            </ButtonLink>
            <ButtonLink href={joinHref} variant="canvas">
              I have a join code
            </ButtonLink>
          </div>

          {/* Docked scoreboard — floats up over the fold */}
          <div
            className="lp-dock relative mx-auto mt-16 grid sm:mt-24 max-w-6xl grid-cols-2 gap-px overflow-hidden rounded-t-card bg-ink/10 shadow-float lg:grid-cols-4"
            style={delay(0.8)}
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

      {/* Features — bento */}
      <section id="season" className="px-4 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto w-full max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
            <h2 className="lp-reveal max-w-[24ch] text-[clamp(34px,4.4vw,64px)] font-semibold leading-[0.98] tracking-[-0.03em] text-white">
              Everything a season needs
            </h2>
            <p className="label pb-2 !text-white/80">06 systems · one league</p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-12">
            {/* 01 Draft — wide cream */}
            <article className="card lp-reveal lp-lift flex flex-col gap-5 p-7 sm:p-8 lg:col-span-7">
              <p className="label !text-accent">01 · Draft</p>
              <h3 className="text-[clamp(24px,2.4vw,34px)] font-semibold leading-tight tracking-[-0.025em]">
                A real draft room
              </h3>
              <p className="max-w-[52ch] text-[17px] leading-[1.55] text-ink-body">
                Snake or linear, pick timer, auto-pick from your queue, rosters
                filling live. Fully usable from a phone in the hallway.
              </p>
              <div className="mt-auto space-y-2">
                {[
                  ["1.01", "J. Carter", "Warriors", false],
                  ["1.02", "M. Brooks", "Titans", false],
                  ["1.03", "On the clock…", "Hawks", true],
                ].map(([no, player, team, live]) => (
                  <div
                    key={no as string}
                    className={`grid grid-cols-[56px_1fr_auto] items-center gap-3 rounded-row px-4 py-3.5 ${
                      live ? "bg-tint text-accent" : "bg-paper"
                    }`}
                  >
                    <span className="num text-[14px] opacity-70">{no}</span>
                    <span className="text-[17px] font-medium">{player}</span>
                    <span className="text-[15px] opacity-70">{team}</span>
                  </div>
                ))}
              </div>
            </article>

            {/* 02 Live stats — dark */}
            <article className="lp-reveal lp-lift flex flex-col gap-5 rounded-card bg-ink p-7 text-white sm:p-8 lg:col-span-5">
              <p className="label !text-blush">02 · Live stats</p>
              <h3 className="text-[clamp(22px,2vw,30px)] font-semibold leading-tight tracking-[-0.025em]">
                Courtside stat tracking
              </h3>
              <p className="text-[16.5px] leading-[1.55] text-white/70">
                Two taps per event, undo anything. Works offline on gym Wi-Fi
                and syncs when you are back. Plus/minus computes itself.
              </p>
              <div className="num mt-auto grid grid-cols-4 gap-2 text-[13px]">
                {["2PT", "3PT", "REB", "AST", "STL", "BLK", "TO", "PF"].map(
                  (e, i) => (
                    <span
                      key={e}
                      className={`rounded-[10px] py-3 text-center ${
                        i === 7
                          ? "bg-accent text-white"
                          : "border border-white/20 text-white/90"
                      }`}
                    >
                      {e}
                    </span>
                  ),
                )}
              </div>
            </article>

            {/* 03 Scheduling */}
            <article className="card lp-reveal lp-lift flex flex-col gap-4 p-7 lg:col-span-4">
              <p className="label !text-accent">03 · Scheduling</p>
              <h3 className="text-[24px] font-semibold leading-tight tracking-[-0.02em]">
                Knows the school day
              </h3>
              <p className="text-[16px] leading-[1.55] text-ink-body">
                Games go into named slots — Lunch A, Free Period 6, After
                School — matched to when both teams actually have players free.
              </p>
              <div className="mt-auto flex flex-wrap gap-2">
                {["Lunch A · Gym 1", "Free 6 · Gym 2"].map((s) => (
                  <span key={s} className="chip !py-2 !text-[14px]">
                    {s}
                  </span>
                ))}
                <span className="inline-flex items-center rounded-full bg-ink/8 px-4 py-2 text-[14px] font-medium">
                  3:30 · Half-court
                </span>
              </div>
            </article>

            {/* 04 Leaders */}
            <article className="card lp-reveal lp-lift flex flex-col gap-4 p-7 lg:col-span-4">
              <p className="label !text-accent">04 · Leaders</p>
              <h3 className="text-[24px] font-semibold leading-tight tracking-[-0.02em]">
                Stats worth arguing about
              </h3>
              <p className="text-[16px] leading-[1.55] text-ink-body">
                Box scores, shooting splits, leaderboards, career totals —
                updated the moment a game goes final.
              </p>
              <div className="mt-auto space-y-3">
                {[
                  ["Carter", 78],
                  ["Brooks", 64],
                  ["Reed", 51],
                ].map(([name, v]) => (
                  <div key={name as string} className="flex items-center gap-4">
                    <span className="num w-14 text-[14px]">{name}</span>
                    <div className="h-[7px] flex-1 rounded-full bg-tint">
                      <div
                        className="lp-bar h-full rounded-full bg-accent"
                        style={{ width: `${((v as number) / 80) * 100}%` }}
                      />
                    </div>
                    <span className="num w-8 text-right text-[14px]">{v}</span>
                  </div>
                ))}
              </div>
            </article>

            {/* 05+06 Trades & Playoffs */}
            <article className="card lp-reveal lp-lift flex flex-col gap-4 p-7 lg:col-span-4">
              <p className="label !text-accent">05 · Trades &amp; playoffs</p>
              <h3 className="text-[24px] font-semibold leading-tight tracking-[-0.02em]">
                Receipts, then a trophy
              </h3>
              <p className="text-[16px] leading-[1.55] text-ink-body">
                Propose, counter, accept — commissioner approval, a locking
                deadline, a public log. Then seeded brackets and season awards.
              </p>
              <div className="mt-auto space-y-2.5">
                <p className="rounded-row bg-paper px-4 py-3 text-[15px] leading-relaxed">
                  Warriors send Carter to Hawks for Brooks and Reed.
                </p>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5">
                  <span className="rounded-row bg-paper px-3.5 py-2.5 text-[15px] font-medium">
                    <span className="num mr-2 text-ink-faint">1</span>Warriors
                  </span>
                  <span aria-hidden className="h-px w-3 bg-accent" />
                  <span className="rounded-row bg-tint px-3.5 py-2.5 text-center text-[15px] font-medium text-accent">
                    Championship
                  </span>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

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
