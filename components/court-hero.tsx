"use client";

/**
 * <CourtHero /> — the landing hero: a giant RUN YOUR LEAGUE marquee scrolling
 * behind a 3D coaching clipboard tumbling in zero gravity, on the brand's
 * Court Blue ground with a film-grain wash and mono corner labels.
 *
 * The section is PINNED: a 240vh wrapper with a sticky 100vh stage. Scroll
 * maps 1:1 to a progress value; the board dwells (tumbling, plus one full
 * scroll-coupled revolution) through the first 68% of the pin, then exits
 * over the last 32% on a smoothstep ease. The stage's DOM layers (marquee,
 * labels) ride only the EXIT portion via the --ch-p variable, so nothing
 * moves during the dwell except the things that are alive.
 *
 * Self-contained on purpose: the Three.js scene is split into
 * court-hero-scene.tsx and loaded with next/dynamic({ ssr: false }) so the
 * WebGL bundle never blocks first paint; an IntersectionObserver defers
 * mounting it until the section is near the viewport and freezes its
 * frameloop whenever it scrolls away. All animation styles are scoped under
 * ch-* names in the component's own <style> block. prefers-reduced-motion
 * gets the old un-pinned 68vh block with a static pose and a still marquee.
 */
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const CourtHeroScene = dynamic(() => import("./court-hero-scene"), {
  ssr: false,
});

/* Film grain: SVG turbulence as a data URI — no asset files. */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

const LINE = "RUN YOUR LEAGUE";

/** Exit begins at 68% of the pin and runs to 100%. */
const EXIT_START = 0.68;

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeMotion(cb: () => void) {
  const mq = window.matchMedia(MOTION_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export type HeroProgress = { p: number; e: number };

export default function CourtHero() {
  const ref = useRef<HTMLElement>(null);
  // p: 0..1 across the whole pin. e: eased exit progress (0 through the
  // dwell, 0..1 over the final stretch). Read per-frame by the scene.
  const progress = useRef<HeroProgress>({ p: 0, e: 0 });
  const [seen, setSeen] = useState(false); // mount the scene once, lazily
  const [active, setActive] = useState(false); // run the frameloop only in view
  const reduced = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(MOTION_QUERY).matches,
    () => false,
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setSeen(true);
        setActive(entry.isIntersecting);
      },
      { rootMargin: "160px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Pin progress: rAF-coalesced, passive, re-measured per frame so resizes
  // are picked up naturally (plus an explicit resize listener). 1:1 with
  // scroll — no momentum, no snapping. Inert under reduced motion.
  useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      const p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
      // Dwell, then a smoothstep-eased exit — smooth into the handoff, no
      // abrupt cutoff when the section releases.
      const raw = Math.min(1, Math.max(0, (p - EXIT_START) / (1 - EXIT_START)));
      const e = raw * raw * (3 - 2 * raw);
      progress.current.p = p;
      progress.current.e = e;
      el.style.setProperty("--ch-p", e.toFixed(4));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduced]);

  return (
    <section
      ref={ref}
      // No aria-label: the page's sr-only h1 already names this content, and
      // a second accessible name on the region would just duplicate it.
      // Reduced motion keeps the original un-pinned single-screen hero.
      className={
        reduced
          ? "relative h-[68vh] max-h-[820px] min-h-[500px] w-full overflow-hidden"
          : "ch-wrap relative w-full"
      }
    >
      <div
        className={
          reduced
            ? "absolute inset-0"
            : "sticky top-0 h-screen w-full overflow-hidden"
        }
      >
        {/* Giant headline marquee, behind the clipboard. Holds through the
            dwell, then sinks and fades on the exit portion only. */}
        <div
          aria-hidden
          className="absolute inset-0 z-0 flex items-center overflow-hidden"
          style={{
            transform: "translateY(calc(var(--ch-p, 0) * 22%))",
            opacity: "calc(1 - var(--ch-p, 0) * 0.9)",
          }}
        >
          <div className="ch-scroll flex w-max">
            {[0, 1].map((i) => (
              <div key={i} className="ch-stretch flex shrink-0 items-center">
                <span className="ch-word">{LINE}</span>
                <span className="ch-word ch-word-outline">{LINE}</span>
              </div>
            ))}
          </div>
        </div>

        {/* The clipboard */}
        <div className="absolute inset-0 z-10">
          {seen ? (
            <CourtHeroScene
              active={active}
              reduced={reduced}
              progress={progress}
            />
          ) : null}
        </div>

        {/* Film grain wash */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 opacity-[0.13] mix-blend-overlay"
          style={{ backgroundImage: GRAIN }}
        />

        {/* Corner labels — fade out first once the exit begins */}
        <div
          className="label pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-between p-5 !text-[11px] !text-white/80 sm:p-7"
          style={{ opacity: "calc(1 - var(--ch-p, 0) * 1.6)" }}
        >
          <span>School intramural sports</span>
          <span className="hidden sm:block">06 systems · one league</span>
        </div>
        <div
          className="label pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-between p-5 !text-[11px] !text-white/60 sm:p-7"
          style={{ opacity: "calc(1 - var(--ch-p, 0) * 1.6)" }}
        >
          <span>Fig. A — coaching board</span>
          <span className="hidden sm:block">Zero gravity · 14s / rev</span>
        </div>
      </div>

      {/* Scoped styles — ch-* names leak nothing into the rest of the site. */}
      <style>{`
        /* ~2.4x the old exit distance: 100vh stage + 140vh of pinned travel */
        .ch-wrap { height: 240vh; }
        .ch-scroll {
          animation: ch-scroll 26s linear infinite;
        }
        .ch-stretch {
          animation: ch-stretch 9s ease-in-out infinite alternate;
        }
        .ch-word {
          padding-right: 0.6em;
          font-size: clamp(110px, 30vh, 300px);
          font-weight: 600;
          letter-spacing: -0.04em;
          line-height: 1;
          white-space: nowrap;
          color: #17171a;
        }
        .ch-word-outline {
          color: transparent;
          -webkit-text-stroke: 2px rgba(23, 23, 26, 0.55);
        }
        @keyframes ch-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes ch-stretch {
          from { transform: scaleY(1); }
          to { transform: scaleY(0.82); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ch-scroll, .ch-stretch { animation: none; }
        }
      `}</style>
    </section>
  );
}
