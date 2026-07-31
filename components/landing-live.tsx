"use client";

/**
 * The landing page's live bits: a pick clock that actually counts down and a
 * game clock that actually runs. Demo data, real motion — the point is that
 * the product is alive, and a looping GIF wouldn't survive the brand's
 * no-fake-screenshot instincts. Numerals are mono per brandbook 05.
 */
import { useEffect, useState } from "react";

const PICK_SECONDS = 134;
const ON_CLOCK = ["Maya Brooks", "Alex Reed", "Jordan Hayes", "Sam Carter"];

function useCountdown() {
  const [t, setT] = useState(PICK_SECONDS);
  const [round, setRound] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setT((prev) => {
        if (prev <= 0) {
          setRound((r) => r + 1);
          return PICK_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);
  const mm = Math.floor(t / 60);
  const ss = String(t % 60).padStart(2, "0");
  return {
    clock: `${mm}:${ss}`,
    name: ON_CLOCK[round % ON_CLOCK.length],
    pct: (t / PICK_SECONDS) * 100,
  };
}

/** Hero dock — LIVE cell: blipping dot, running game clock. */
export function LiveScoreCell() {
  const { clock } = useCountdown();
  return (
    <div>
      <p className="label flex items-center gap-2 !text-[11px] !text-accent">
        <span className="size-2 rounded-full bg-accent lp-blip" />
        Live
      </p>
      <p className="num mt-2.5 text-[19px] text-ink sm:text-[22px]">
        Warriors 42 · Hawks 38
      </p>
      <p className="num mt-1 text-[13px] text-ink-muted">Q4 · {clock}</p>
    </div>
  );
}

/** Hero dock — ON THE CLOCK cell: the name rotates as picks "resolve". */
export function OnClockCell() {
  const { name } = useCountdown();
  return (
    <div>
      <p className="label !text-[11px]">On the clock</p>
      <p className="mt-2.5 truncate text-[19px] font-medium text-ink sm:text-[22px]">
        {name}
      </p>
      <p className="num mt-1 text-[13px] text-ink-muted">Pick 1.12 · queue 6 deep</p>
    </div>
  );
}

/** The red half of the draft-board panel: countdown, name, draining bar. */
export function DraftBoardClock() {
  const { clock, name, pct } = useCountdown();
  return (
    <div className="flex h-full flex-col justify-center gap-3.5 p-10 text-white sm:p-11">
      <p className="label !text-white/80">Pick 1.12 · Titans</p>
      <p className="text-[clamp(34px,4.2vw,68px)] font-semibold leading-[0.95] tracking-[-0.03em]">
        {name}
      </p>
      <p className="num text-[15px] text-white/90">Auto-picks in {clock}</p>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/30">
        <div
          className="h-full rounded-full bg-white transition-[width] duration-1000 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
