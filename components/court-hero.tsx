"use client";

/**
 * <CourtHero /> — the landing hero: a giant RUN YOUR LEAGUE marquee scrolling
 * behind a 3D coaching clipboard tumbling in zero gravity, on the brand's
 * Court Blue ground with a film-grain wash and mono corner labels.
 *
 * Self-contained on purpose: the Three.js scene is split into
 * court-hero-scene.tsx and loaded with next/dynamic({ ssr: false }) so the
 * WebGL bundle never blocks first paint; an IntersectionObserver defers
 * mounting it until the section is near the viewport and freezes its
 * frameloop whenever it scrolls away. All animation styles are scoped under
 * ch-* names in the component's own <style> block, and the whole thing
 * respects prefers-reduced-motion (static pose, no marquee).
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

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeMotion(cb: () => void) {
  const mq = window.matchMedia(MOTION_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export default function CourtHero() {
  const ref = useRef<HTMLElement>(null);
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

  return (
    <section
      ref={ref}
      aria-label="Run your league"
      className="relative h-[72vh] max-h-[860px] min-h-[520px] w-full overflow-hidden"
    >
      {/* Giant headline marquee, behind the clipboard */}
      <div
        aria-hidden
        className="absolute inset-0 z-0 flex items-center overflow-hidden"
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
        {seen ? <CourtHeroScene active={active} reduced={reduced} /> : null}
      </div>

      {/* Film grain wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20 opacity-[0.13] mix-blend-overlay"
        style={{ backgroundImage: GRAIN }}
      />

      {/* Corner labels */}
      <div className="label pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-between p-5 !text-[11px] !text-white/80 sm:p-7">
        <span>School intramural sports</span>
        <span className="hidden sm:block">06 systems · one league</span>
      </div>
      <div className="label pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-between p-5 !text-[11px] !text-white/60 sm:p-7">
        <span>Fig. A — coaching board</span>
        <span className="hidden sm:block">Zero gravity · 14s / rev</span>
      </div>

      {/* Scoped styles — ch-* names leak nothing into the rest of the site. */}
      <style>{`
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
