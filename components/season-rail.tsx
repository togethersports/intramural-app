"use client";

/**
 * "Everything a season needs" as a pinned horizontal rail.
 *
 * No animation library: a sticky viewport inside a tall wrapper, with a
 * rAF-coalesced scroll handler turning vertical scroll into horizontal
 * translate3d — the same pattern the 3D hero uses. Card poses (scale,
 * opacity, y, rotateY) are computed per frame from each card's distance to
 * the viewport center, transform/opacity only, will-change applied only
 * while the section is actually pinned.
 *
 * Below 900px the pin is disabled entirely and the rail becomes a native
 * scroll-snap carousel. Under prefers-reduced-motion everything loops stop
 * and the cards render as a plain vertical stack. Nothing leaves the DOM in
 * any mode; cards stay in tab order.
 *
 * All styles are scoped under sr-* names in the component's <style> block.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const DESKTOP_QUERY = "(min-width: 900px)";

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    useCallback(
      (cb: () => void) => {
        const mq = window.matchMedia(query);
        mq.addEventListener("change", cb);
        return () => mq.removeEventListener("change", cb);
      },
      [query],
    ),
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/* ------------------------------------------------------------------ draft */

/** The rolling board: same names as the rest of the landing page. */
const DRAFT_FEED = [
  { no: "1.01", player: "J. Carter", team: "Warriors" },
  { no: "1.02", player: "M. Brooks", team: "Titans" },
  { no: "1.03", player: "S. Reed", team: "Hawks" },
  { no: "1.04", player: "R. Hayes", team: "Suns" },
  { no: "1.05", player: "D. Miller", team: "Bolts" },
];
const ON_CLOCK_TEAMS = ["Hawks", "Suns", "Bolts", "Warriors", "Titans"];
const PICK_CYCLE_MS = 8000;

function DraftRows({ running }: { running: boolean }) {
  // `step` slides the window down the feed: two resolved picks, then the
  // team on the clock. Starts exactly on the original static copy.
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(
      () => setStep((s) => (s + 1) % DRAFT_FEED.length),
      PICK_CYCLE_MS,
    );
    return () => clearInterval(id);
  }, [running]);

  const at = (i: number) => DRAFT_FEED[(step + i) % DRAFT_FEED.length];
  const onClockTeam = ON_CLOCK_TEAMS[(step + 2) % ON_CLOCK_TEAMS.length];

  return (
    <div className="mt-auto space-y-2">
      {[at(0), at(1)].map((p) => (
        <div
          key={p.no}
          className="sr-row-in grid grid-cols-[56px_1fr_auto] items-center gap-3 rounded-row bg-paper px-4 py-3.5"
        >
          <span className="num text-[14px] opacity-70">{p.no}</span>
          <span className="text-[17px] font-medium">{p.player}</span>
          <span className="text-[15px] opacity-70">{p.team}</span>
        </div>
      ))}
      <div className="sr-onclock grid grid-cols-[56px_1fr_auto] items-center gap-3 rounded-row bg-tint px-4 py-3.5 text-accent">
        <span className="num text-[14px] opacity-70">{at(2).no}</span>
        <span className="text-[17px] font-medium">On the clock…</span>
        <span className="text-[15px] opacity-70">{onClockTeam}</span>
      </div>
      {/* the pick timer, running down in sync with the row rotation */}
      <div className="h-1 overflow-hidden rounded-full bg-tint">
        <div className="sr-deplete h-full w-full rounded-full bg-accent" />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- live stats */

const STAT_KEYS = ["2PT", "3PT", "REB", "AST", "STL", "BLK", "TO", "PF"];

function StatPad({ running }: { running: boolean }) {
  const [lit, setLit] = useState(-1);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setLit(Math.floor(Math.random() * STAT_KEYS.length));
    }, 950);
    return () => clearInterval(id);
  }, [running]);

  return (
    <div className="num mt-auto grid grid-cols-4 gap-2 text-[13px]">
      {STAT_KEYS.map((e, i) => (
        <span
          key={`${e}-${lit === i ? lit : "idle"}`}
          className={`rounded-[10px] py-3 text-center ${
            i === 7
              ? "bg-accent text-white"
              : "border border-white/20 text-white/90"
          } ${lit === i ? "sr-flash" : ""}`}
        >
          {e}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ cards */

const CARD_COUNT = 5;

function Cards({ running }: { running: boolean }) {
  /* Copy is identical to the previous bento — only the wrapper moved. */
  return (
    <>
      <article tabIndex={0} className="sr-card card flex flex-col gap-5 p-7 sm:p-8">
        <p className="label !text-accent">01 · Draft</p>
        <div className="sr-inner flex min-h-0 flex-1 flex-col gap-5">
          <h3 className="text-[clamp(24px,2.4vw,34px)] font-semibold leading-tight tracking-[-0.025em]">
            A real draft room
          </h3>
          <p className="max-w-[52ch] text-[17px] leading-[1.55] text-ink-body">
            Snake or linear, pick timer, auto-pick from your queue, rosters
            filling live. Fully usable from a phone in the hallway.
          </p>
          <DraftRows running={running} />
        </div>
      </article>

      <article
        tabIndex={0}
        className="sr-card flex flex-col gap-5 rounded-card bg-ink p-7 text-white sm:p-8"
      >
        <p className="label !text-blush">02 · Live stats</p>
        <div className="sr-inner flex min-h-0 flex-1 flex-col gap-5">
          <h3 className="text-[clamp(22px,2vw,30px)] font-semibold leading-tight tracking-[-0.025em]">
            Courtside stat tracking
          </h3>
          <p className="text-[16.5px] leading-[1.55] text-white/70">
            Two taps per event, undo anything. Works offline on gym Wi-Fi and
            syncs when you are back. Plus/minus computes itself.
          </p>
          <StatPad running={running} />
        </div>
      </article>

      <article tabIndex={0} className="sr-card card flex flex-col gap-4 p-7">
        <p className="label !text-accent">03 · Scheduling</p>
        <div className="sr-inner flex min-h-0 flex-1 flex-col gap-4">
          <h3 className="text-[24px] font-semibold leading-tight tracking-[-0.02em]">
            Knows the school day
          </h3>
          <p className="text-[16px] leading-[1.55] text-ink-body">
            Games go into named slots — Lunch A, Free Period 6, After School —
            matched to when both teams actually have players free.
          </p>
          <div className="mt-auto flex flex-wrap gap-2">
            {["Lunch A · Gym 1", "Free 6 · Gym 2"].map((s, i) => (
              <span
                key={s}
                className="chip sr-slot !py-2 !text-[14px]"
                style={{ animationDelay: `${i * 2}s` }}
              >
                {s}
              </span>
            ))}
            <span
              className="sr-slot inline-flex items-center rounded-full bg-ink/8 px-4 py-2 text-[14px] font-medium"
              style={{ animationDelay: "4s" }}
            >
              3:30 · Half-court
            </span>
          </div>
        </div>
      </article>

      <article tabIndex={0} className="sr-card card flex flex-col gap-4 p-7">
        <p className="label !text-accent">04 · Leaders</p>
        <div className="sr-inner flex min-h-0 flex-1 flex-col gap-4">
          <h3 className="text-[24px] font-semibold leading-tight tracking-[-0.02em]">
            Stats worth arguing about
          </h3>
          <p className="text-[16px] leading-[1.55] text-ink-body">
            Box scores, shooting splits, leaderboards, career totals — updated
            the moment a game goes final.
          </p>
          <div className="mt-auto space-y-3">
            {[
              ["Carter", 78],
              ["Brooks", 64],
              ["Reed", 51],
            ].map(([name, v], i) => (
              <div key={name as string} className="flex items-center gap-4">
                <span className="num w-14 text-[14px]">{name}</span>
                <div className="h-[7px] flex-1 rounded-full bg-tint">
                  <div
                    className="sr-meter h-full rounded-full bg-accent"
                    style={{
                      width: `${((v as number) / 80) * 100}%`,
                      animationDelay: `${i * 0.7}s`,
                    }}
                  />
                </div>
                <span className="num w-8 text-right text-[14px]">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </article>

      <article tabIndex={0} className="sr-card card flex flex-col gap-4 p-7">
        <p className="label !text-accent">05 · Trades &amp; playoffs</p>
        <div className="sr-inner flex min-h-0 flex-1 flex-col gap-4">
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
              <span aria-hidden className="sr-draw h-px w-3 bg-accent" />
              <span className="sr-champ rounded-row bg-tint px-3.5 py-2.5 text-center text-[15px] font-medium text-accent">
                Championship
              </span>
            </div>
          </div>
        </div>
      </article>
    </>
  );
}

/* ---------------------------------------------------------------- section */

export default function SeasonRail() {
  const wrapRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [entered, setEntered] = useState(false);
  const [counter, setCounter] = useState(1);
  const reduced = useMedia(MOTION_QUERY);
  const desktop = useMedia(DESKTOP_QUERY);
  const pinning = desktop && !reduced;

  // Entrance + loop gating.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        setInView(e.isIntersecting);
        if (e.isIntersecting) setEntered(true);
      },
      { rootMargin: "80px 0px", threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // The pin: vertical scroll → horizontal translate3d + per-card pose.
  useEffect(() => {
    if (!pinning) {
      // leaving pin mode: clear any inline transforms the rig set
      const track = trackRef.current;
      if (track) {
        track.style.transform = "";
        for (const card of Array.from(track.children) as HTMLElement[]) {
          card.style.transform = "";
          card.style.opacity = "";
          const inner = card.querySelector<HTMLElement>(".sr-inner");
          if (inner) inner.style.transform = "";
        }
      }
      return;
    }
    const wrap = wrapRef.current;
    const track = trackRef.current;
    if (!wrap || !track) return;

    let raf = 0;
    let width = 0;
    let max = 0;
    let lastIdx = -1;
    let pinnedNow = false;

    const measure = () => {
      width = window.innerWidth;
      max = Math.max(0, track.scrollWidth - width);
    };

    const frame = () => {
      raf = 0;
      const r = wrap.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      const p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
      // The rail finishes at 92% of the pin, so the last card gets a beat at
      // center before the section releases instead of unpinning mid-arrival.
      const x = -Math.min(1, p / 0.92) * max;
      track.style.transform = `translate3d(${x}px, 0, 0)`;

      const isPinned = p > 0.001 && p < 0.999;
      if (isPinned !== pinnedNow) {
        pinnedNow = isPinned;
        track.classList.toggle("sr-willchange", isPinned);
      }

      const cards = Array.from(track.children) as HTMLElement[];
      const center = width / 2;
      let nearest = 0;
      let nearestD = Infinity;
      cards.forEach((card, i) => {
        const cr = card.getBoundingClientRect();
        const d = (cr.left + cr.width / 2 - center) / width; // -: past, +: coming
        const a = Math.min(1, Math.abs(d) * 1.6);
        const entering = d > 0;
        const scale = 1 - a * (entering ? 0.06 : 0.04);
        const y = entering ? a * 30 : 0;
        const rot = entering ? a * 4 : 0;
        card.style.transform = `translate3d(0, ${y}px, 0) rotateY(${-rot}deg) scale(${scale})`;
        card.style.opacity = String(1 - a * (entering ? 0.6 : 0.35));
        // soft parallax: copy drifts at ~0.85x of the card's travel
        const inner = card.querySelector<HTMLElement>(".sr-inner");
        if (inner)
          inner.style.transform = `translate3d(${d * width * 0.045}px, 0, 0)`;
        const abs = Math.abs(d);
        if (abs < nearestD) {
          nearestD = abs;
          nearest = i;
        }
      });
      if (nearest !== lastIdx) {
        lastIdx = nearest;
        setCounter(nearest + 1);
      }
      if (barRef.current)
        barRef.current.style.transform = `scaleX(${p})`;
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const onResize = () => {
      measure();
      onScroll();
    };
    measure();
    frame();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
      track.classList.remove("sr-willchange");
    };
  }, [pinning]);

  const running = inView && !reduced;

  return (
    <section
      id="season"
      ref={wrapRef}
      className={`sr-wrap relative ${entered ? "sr-in" : ""} ${
        reduced ? "sr-reduced" : ""
      }`}
      style={pinning ? { height: `${100 + CARD_COUNT * 60}vh` } : undefined}
    >
      <div className={pinning ? "sticky top-0 flex h-screen flex-col justify-center overflow-hidden" : "py-20 sm:py-24"}>
        <div className="px-4 sm:px-6">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-end justify-between gap-x-8 gap-y-3">
            <h2
              aria-label="Everything a season needs"
              className="max-w-[24ch] text-[clamp(34px,4.4vw,64px)] font-semibold leading-[0.98] tracking-[-0.03em] text-white"
            >
              {/* mr, not a trailing space: whitespace inside an inline-block
                  wrapper is trimmed, which glued the words together */}
              {"Everything a season needs".split(" ").map((w, i) => (
                <span
                  key={i}
                  aria-hidden
                  className="mr-[0.26em] inline-block overflow-visible"
                >
                  <span
                    className="sr-word inline-block"
                    style={{ animationDelay: `${i * 0.06}s` }}
                  >
                    {w}
                  </span>
                </span>
              ))}
            </h2>
            <p className="label sr-label pb-2 !text-white/80">
              06 systems · one league
            </p>
          </div>
        </div>

        {/* The rail. Pinned: transformed row. Mobile: native snap carousel.
            Reduced motion: a plain vertical stack. */}
        <div className={pinning ? "mt-10 overflow-hidden" : "mt-10"}>
          <div
            ref={trackRef}
            className={
              pinning
                ? "sr-track flex items-stretch gap-6 pl-[max(1rem,calc(50vw-260px))] pr-[50vw]"
                : reduced
                  ? "mx-auto grid w-full max-w-7xl gap-5 px-4 sm:px-6 lg:grid-cols-2"
                  : "sr-snap flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto px-4 pb-4 sm:px-6"
            }
          >
            <Cards running={running} />
          </div>
        </div>

        {/* Progress: thin bar + counter, only meaningful while pinned */}
        {pinning ? (
          <div className="mt-9 flex items-center justify-center gap-4">
            <p className="label !text-[11px] !text-white/80">
              <span className="num">{String(counter).padStart(2, "0")}</span> /{" "}
              <span className="num">{String(CARD_COUNT).padStart(2, "0")}</span>
            </p>
            <div className="h-[3px] w-44 overflow-hidden rounded-full bg-white/25">
              <div
                ref={barRef}
                className="h-full w-full origin-left rounded-full bg-surface"
                style={{ transform: "scaleX(0)" }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <style>{`
        .sr-track { will-change: auto; transform-style: preserve-3d; perspective: 1200px; }
        .sr-willchange, .sr-willchange > article { will-change: transform, opacity; }
        .sr-card {
          width: min(520px, 86vw);
          flex: 0 0 auto;
          transition: box-shadow .2s ease;
          outline: none;
        }
        .sr-card:hover { box-shadow: 0 18px 50px rgb(23 23 26 / .16); }
        .sr-card:focus-visible { outline: 2px solid #c9242c; outline-offset: 3px; }
        .sr-snap .sr-card { scroll-snap-align: center; width: min(440px, 86vw); }
        .sr-reduced .sr-card { width: auto; }

        /* entrance: words rise out of a blur; label slides from the right */
        .sr-word, .sr-label { opacity: 0; }
        .sr-in .sr-word {
          animation: sr-word .8s cubic-bezier(.16,.84,.28,1) both;
        }
        .sr-in .sr-label {
          animation: sr-side .7s cubic-bezier(.16,.84,.28,1) .2s both;
        }
        @keyframes sr-word {
          from { opacity: 0; transform: translateY(40px); filter: blur(8px); }
          to { opacity: 1; transform: none; filter: blur(0); }
        }
        @keyframes sr-side {
          from { opacity: 0; transform: translateX(28px); }
          to { opacity: 1; transform: none; }
        }

        /* card micro-loops — all pause off-screen, all die under reduced motion */
        .sr-onclock { animation: sr-breathe 2.6s ease-in-out infinite; }
        @keyframes sr-breathe {
          0%, 100% { background-color: #f7dcdc; }
          50% { background-color: #f3c9c9; }
        }
        .sr-deplete {
          transform-origin: left center;
          animation: sr-deplete ${PICK_CYCLE_MS}ms linear infinite;
        }
        @keyframes sr-deplete { from { transform: scaleX(1); } to { transform: scaleX(0); } }
        .sr-row-in { animation: sr-rowin .45s cubic-bezier(.16,.84,.28,1) both; }
        @keyframes sr-rowin {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: none; }
        }
        /* background + text only — letting border-color interpolate produced
           an off-brand halo mid-animation */
        .sr-flash { animation: sr-flash .55s ease-out both; }
        @keyframes sr-flash {
          0%, 45% { background-color: #c9242c; color: #fff; }
          100% { background-color: transparent; color: inherit; }
        }
        .sr-slot { animation: sr-slot 6s ease-in-out infinite; }
        @keyframes sr-slot {
          0%, 88%, 100% { transform: none; opacity: 1; }
          92% { transform: scale(1.05); opacity: .85; }
        }
        .sr-meter {
          transform-origin: left center;
          animation: sr-meter 5s ease-in-out infinite alternate;
        }
        @keyframes sr-meter { from { transform: scaleX(.96); } to { transform: scaleX(1); } }
        .sr-draw {
          transform-origin: left center;
          animation: sr-draw 3.6s cubic-bezier(.6,0,.2,1) infinite;
        }
        @keyframes sr-draw {
          0% { transform: scaleX(0); }
          35%, 80% { transform: scaleX(1); }
          100% { transform: scaleX(0); }
        }
        .sr-champ { animation: sr-champ 3.6s ease-in-out infinite; }
        @keyframes sr-champ {
          0%, 30%, 100% { opacity: .75; }
          45%, 75% { opacity: 1; }
        }

        /* pausing: anything outside the viewport freezes; reduced motion kills */
        section#season:not(.sr-in) [class*="sr-"] { animation-play-state: paused; }
        .sr-reduced .sr-word, .sr-reduced .sr-label { opacity: 1; animation: none; }
        .sr-reduced .sr-onclock, .sr-reduced .sr-deplete, .sr-reduced .sr-row-in,
        .sr-reduced .sr-flash, .sr-reduced .sr-slot, .sr-reduced .sr-meter,
        .sr-reduced .sr-draw, .sr-reduced .sr-champ { animation: none; }
        @media (prefers-reduced-motion: reduce) {
          .sr-word, .sr-label { opacity: 1 !important; animation: none !important; }
          section#season [class*="sr-"] { animation: none !important; }
        }
      `}</style>
    </section>
  );
}
