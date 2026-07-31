"use client";

/**
 * "Everything a season needs" — one card at a time, scroll-locked, each card
 * a dense product-UI mockup rather than copy plus a widget.
 *
 * The lock is a sticky stage in a tall wrapper (native scroll, never
 * hijacked): progress maps to a stepped card position with a hold at each
 * card, and a light smoothing loop settles mid-transition positions onto the
 * nearest card once scrolling pauses — assistive snap, input always moves
 * the rail immediately. Backward scroll steps back and releases upward.
 *
 * Cards render ~82vw and centered; neighbours peek < 5vw. Outgoing cards
 * scale to .92 / fade to .3 and slide left; incoming mirror from the right.
 * transform + opacity only, translate3d, will-change only while pinned.
 *
 * Below 900px: no pinning, native scroll-snap carousel, mockups simplified
 * via responsive classes. prefers-reduced-motion: plain vertical stack,
 * every loop dead. IntersectionObserver pauses all loops offscreen. Nothing
 * ever leaves the DOM; the mockup controls are real buttons in tab order.
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

const CARD_COUNT = 6;

/* ================================================================ mockups */

/** Mono micro-label used across the mockups. */
function Tag({ children, tone }: { children: React.ReactNode; tone?: "red" | "dark" }) {
  return (
    <span
      className={`num rounded px-1.5 py-0.5 text-[10px] tracking-[0.08em] ${
        tone === "red"
          ? "bg-tint text-accent"
          : tone === "dark"
            ? "bg-ink text-white"
            : "bg-ink/8 text-ink-muted"
      }`}
    >
      {children}
    </span>
  );
}

/* ----------------------------------------------------------- 01 · draft */

function DraftMock() {
  const [mode, setMode] = useState<"snake" | "linear">("snake");
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-[1.15fr_1fr_1fr]">
      {/* pick order */}
      <div className="flex min-h-0 flex-col rounded-panel border border-ink/8 bg-paper p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="label !text-[10px]">Round 1</p>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-bench" />
            <span className="num text-[10px] text-ink-muted">CONNECTED</span>
          </span>
        </div>
        {[
          ["1.01", "J. Carter", "Warriors", "done"],
          ["1.02", "M. Brooks", "Titans", "done"],
          ["1.03", "On the clock…", "Hawks", "live"],
          ["1.04", "—", "Suns", "next"],
          ["1.05", "—", "Bolts", "next"],
          ["1.06", "—", "Titans", "next"],
        ].map(([no, who, team, st]) => (
          <div
            key={no as string}
            className={`grid grid-cols-[44px_1fr_auto] items-center gap-2 border-b border-ink/6 py-2 text-[13px] last:border-0 ${
              st === "live"
                ? "text-accent"
                : st === "next"
                  ? "text-ink-faint"
                  : ""
            }`}
          >
            <span className="num text-[11px] opacity-70">{no}</span>
            <span className={st === "done" ? "font-medium" : ""}>{who}</span>
            <span className="text-[11px] opacity-70">{team}</span>
          </div>
        ))}
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-tint">
          <div className="sr-deplete h-full w-full rounded-full bg-accent" />
        </div>
        <div className="mt-2 flex gap-1">
          {(["snake", "linear"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`num rounded px-2 py-1 text-[10px] uppercase tracking-[0.08em] ${
                mode === m ? "bg-ink text-white" : "bg-ink/8 text-ink-muted"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      {/* queue */}
      <div className="hidden min-h-0 flex-col rounded-panel border border-ink/8 bg-paper p-3 sm:flex">
        <p className="label mb-2 !text-[10px]">My queue</p>
        {[
          ["S. Reed", "G"],
          ["R. Hayes", "F"],
          ["D. Miller", "C"],
          ["A. Cole", "G"],
          ["B. Nash", "F"],
          ["T. Osei", "C"],
        ].map(([who, pos], i) => (
          <div
            key={who}
            className="grid grid-cols-[14px_1fr_auto_auto] items-center gap-2 border-b border-ink/6 py-2 text-[13px] last:border-0"
          >
            <span aria-hidden className="flex flex-col gap-[3px]">
              <span className="h-px w-3 bg-ink/25" />
              <span className="h-px w-3 bg-ink/25" />
              <span className="h-px w-3 bg-ink/25" />
            </span>
            <span>{who}</span>
            <Tag>{pos}</Tag>
            <span className="num text-[11px] text-ink-faint">{i + 1}</span>
          </div>
        ))}
        <p className="num mt-auto pt-2 text-[10px] text-ink-faint">
          AUTO-PICK FROM QUEUE · ON
        </p>
      </div>
      {/* roster grid */}
      <div className="hidden min-h-0 flex-col rounded-panel border border-ink/8 bg-paper p-3 sm:flex">
        <p className="label mb-2 !text-[10px]">Titans roster</p>
        <div className="grid flex-1 grid-rows-6 gap-1.5">
          {["M. Brooks", "T. Ford", "L. Price", null, null, null].map(
            (who, i) => (
              <div
                key={i}
                className={`flex items-center justify-between rounded px-2 text-[12px] ${
                  who
                    ? "bg-surface"
                    : "border border-dashed border-ink/15 text-ink-faint"
                }`}
              >
                <span>{who ?? `Slot ${i + 1}`}</span>
                {who ? <Tag>{i === 0 ? "C" : i === 1 ? "G" : "F"}</Tag> : null}
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- 02 · live stats */

const STAT_KEYS = ["2PT", "3PT", "REB", "AST", "STL", "BLK", "TO", "PF"];
const BOX_BASE = [
  { name: "Carter", pts: 12, reb: 5, ast: 3, pm: 6 },
  { name: "Brooks", pts: 9, reb: 7, ast: 2, pm: -2 },
  { name: "Reed", pts: 7, reb: 2, ast: 5, pm: 4 },
  { name: "Hayes", pts: 4, reb: 6, ast: 1, pm: 1 },
];

function StatsMock({ running }: { running: boolean }) {
  const [lit, setLit] = useState(-1);
  const [tick, setTick] = useState(0);
  const [box, setBox] = useState(BOX_BASE);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const key = Math.floor(Math.random() * 7); // PF stays resting-red
      setLit(key);
      setTick((t) => t + 1);
      // a tap lands in the box score: points for shots, boards for REB…
      setBox((rows) => {
        const i = Math.floor(Math.random() * rows.length);
        return rows.map((r, j) =>
          j === i
            ? {
                ...r,
                pts: r.pts + (key === 0 ? 2 : key === 1 ? 3 : 0),
                reb: r.reb + (key === 2 ? 1 : 0),
                ast: r.ast + (key === 3 ? 1 : 0),
                pm: r.pm + (key <= 1 ? 1 : 0),
              }
            : r,
        );
      });
    }, 1100);
    return () => clearInterval(id);
  }, [running]);
  const synced = tick % 6 < 4;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between rounded-panel border border-white/10 bg-white/5 px-3 py-2">
        <span className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-accent lp-blip" />
          <span className="num text-[12px] text-white">Q4 · 2:14</span>
        </span>
        <span className="flex items-center gap-2">
          <button
            type="button"
            className="num rounded border border-white/20 px-2 py-1 text-[10px] text-white/80"
          >
            UNDO
          </button>
          <span
            className={`num rounded px-2 py-1 text-[10px] ${
              synced ? "bg-white/10 text-white/80" : "bg-accent text-white"
            }`}
          >
            {synced ? "SYNCED" : "OFFLINE"}
          </span>
        </span>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-[1fr_1.2fr]">
        <div className="num grid auto-rows-fr grid-cols-4 gap-1.5 text-[12px]">
          {STAT_KEYS.map((e, i) => (
            <button
              type="button"
              key={`${e}-${lit === i ? tick : "idle"}`}
              className={`grid place-items-center rounded-[10px] ${
                i === 7
                  ? "bg-accent text-white"
                  : "border border-white/20 text-white/90"
              } ${lit === i ? "sr-flash" : ""}`}
            >
              {e}
            </button>
          ))}
        </div>
        <div className="flex flex-col rounded-panel border border-white/10 bg-white/5 p-2">
          <div className="num grid grid-cols-[1fr_repeat(4,44px)] gap-1 border-b border-white/15 px-2 pb-1.5 text-[10px] tracking-[0.1em] text-white/50">
            <span>PLAYER</span>
            <span className="text-right">PTS</span>
            <span className="text-right">REB</span>
            <span className="text-right">AST</span>
            <span className="text-right">+/−</span>
          </div>
          {box.map((r, i) => (
            <div
              key={r.name}
              className={`num grid grid-cols-[1fr_repeat(4,44px)] gap-1 px-2 py-1.5 text-[12px] text-white/90 ${
                i < box.length - 1 ? "border-b border-white/8" : ""
              } ${i >= 2 ? "hidden sm:grid" : ""}`}
            >
              <span className="font-sans">{r.name}</span>
              <span className="text-right">{r.pts}</span>
              <span className="text-right">{r.reb}</span>
              <span className="text-right">{r.ast}</span>
              <span className={`text-right ${r.pm < 0 ? "text-blush" : ""}`}>
                {r.pm > 0 ? `+${r.pm}` : r.pm}
              </span>
            </div>
          ))}
          <div className="num mt-auto grid grid-cols-[1fr_repeat(4,44px)] gap-1 border-t border-white/15 px-2 pt-1.5 text-[12px] text-white">
            <span className="font-sans">Warriors</span>
            <span className="text-right">{box.reduce((n, r) => n + r.pts, 0)}</span>
            <span className="text-right">{box.reduce((n, r) => n + r.reb, 0)}</span>
            <span className="text-right">{box.reduce((n, r) => n + r.ast, 0)}</span>
            <span className="text-right">—</span>
          </div>
          <p className="num px-2 pt-1.5 text-[10px] text-white/40">
            EVENT LOG · 47 EVENTS · ALL REVERSIBLE
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------ 03 · scheduling */

function ScheduleMock() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const slots = ["Lunch A", "Free 6", "After Sch"];
  // availability heat per cell (0..3) + placed games
  const heat = [
    [3, 1, 2, 3, 0],
    [1, 2, 3, 1, 2],
    [2, 3, 1, 2, 3],
  ];
  const games: Record<string, string[]> = {
    "0-0": ["WAR–HAW", "Gym 1"],
    "1-2": ["TIT–SUN", "Gym 2"],
    "2-4": ["BOL–WAR", "Gym 1"],
    "0-3": ["SUN–HAW", "Gym 1"],
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-panel border border-ink/8 bg-paper p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="label !text-[10px]">Week 5</p>
        <Tag tone="red">1 conflict · Free 6 Thu</Tag>
      </div>
      <div
        className="grid flex-1 gap-1"
        style={{ gridTemplateColumns: "64px repeat(5, 1fr)" }}
      >
        <span />
        {days.map((d, i) => (
          <span
            key={d}
            className={`label !text-[10px] text-center ${i > 2 ? "hidden sm:block" : ""}`}
          >
            {d}
          </span>
        ))}
        {slots.map((s, r) => (
          <>
            <span key={s} className="label self-center !text-[10px]">
              {s}
            </span>
            {days.map((d, c) => {
              const g = games[`${r}-${c}`];
              return (
                <div
                  key={`${r}-${c}`}
                  className={`relative min-h-11 rounded ${c > 2 ? "hidden sm:block" : ""}`}
                  style={{
                    backgroundColor: `rgb(78 124 168 / ${0.06 + heat[r][c] * 0.07})`,
                  }}
                >
                  {g ? (
                    <div
                      className={`absolute inset-0.5 flex flex-col justify-center rounded bg-bench px-1.5 text-white ${
                        r === 2 && c === 4 ? "sr-drop" : ""
                      }`}
                    >
                      <span className="num text-[10px] leading-tight">{g[0]}</span>
                      <span className="text-[9px] leading-tight opacity-80">
                        {g[1]}
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </>
        ))}
      </div>
      <p className="num mt-2 text-[10px] text-ink-faint">
        SHADE = PLAYERS FREE · DARKER IS BETTER
      </p>
    </div>
  );
}

/* --------------------------------------------------------- 04 · leaders */

const LEADER_COLS = ["PPG", "RPG", "APG", "FG%"] as const;
const LEADERS = [
  { name: "J. Carter", team: "WAR", vals: [19.5, 6.2, 3.1, 54] },
  { name: "M. Brooks", team: "TIT", vals: [16.0, 8.4, 2.2, 48] },
  { name: "S. Reed", team: "HAW", vals: [12.8, 3.9, 6.5, 44] },
  { name: "R. Hayes", team: "SUN", vals: [11.2, 7.1, 1.8, 51] },
];

function LeadersMock() {
  const [col, setCol] = useState(0);
  const [span, setSpan] = useState<"season" | "career">("season");
  const max = Math.max(...LEADERS.map((l) => l.vals[col]));
  const rows = [...LEADERS].sort((a, b) => b.vals[col] - a.vals[col]);
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-[1.5fr_1fr]">
      <div className="flex min-h-0 flex-col rounded-panel border border-ink/8 bg-paper p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex gap-1">
            {(["season", "career"] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={span === s}
                onClick={() => setSpan(s)}
                className={`num rounded px-2 py-1 text-[10px] uppercase tracking-[0.08em] ${
                  span === s ? "bg-ink text-white" : "bg-ink/8 text-ink-muted"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="num flex gap-1 text-[10px]">
            {LEADER_COLS.map((c, i) => (
              <button
                key={c}
                type="button"
                aria-pressed={col === i}
                onClick={() => setCol(i)}
                className={`rounded px-1.5 py-1 ${
                  col === i ? "bg-tint text-accent" : "text-ink-muted"
                }`}
              >
                {c}
                {col === i ? " ▾" : ""}
              </button>
            ))}
          </div>
        </div>
        {rows.map((l, i) => (
          <div
            key={l.name}
            className="grid grid-cols-[18px_26px_1fr_auto] items-center gap-2 border-b border-ink/6 py-2 last:border-0"
          >
            <span className="num text-[11px] text-ink-faint">{i + 1}</span>
            <span className="grid size-6 place-items-center rounded-full bg-ink text-[9px] font-semibold text-white">
              {l.name.split(" ")[1].slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium">
                {l.name} <span className="num text-[10px] text-ink-faint">{l.team}</span>
              </span>
              <span className="mt-1 block h-[5px] rounded-full bg-tint">
                <span
                  className="sr-meter block h-full rounded-full bg-accent"
                  style={{ width: `${(l.vals[col] / max) * 100}%`, animationDelay: `${i * 0.6}s` }}
                />
              </span>
            </span>
            <span className="num text-[13px]">
              {l.vals[col]}{col === 3 ? "%" : ""}
            </span>
          </div>
        ))}
      </div>
      <div className="hidden min-h-0 flex-col rounded-panel border border-ink/8 bg-paper p-3 sm:flex">
        <p className="label mb-2 !text-[10px]">Carter · shooting</p>
        {[
          ["2PT", 54],
          ["3PT", 38],
          ["FT", 81],
        ].map(([k, v]) => (
          <div key={k as string} className="mb-2">
            <div className="num mb-1 flex justify-between text-[11px]">
              <span className="text-ink-muted">{k}</span>
              <span>{v}%</span>
            </div>
            <div className="h-[5px] rounded-full bg-tint">
              <div
                className="h-full rounded-full bg-ink"
                style={{ width: `${v}%` }}
              />
            </div>
          </div>
        ))}
        <div className="num mt-auto rounded bg-surface p-2 text-[10px] leading-relaxed text-ink-muted">
          LAST 5 · 22 / 18 / 25 / 14 / 19 PTS
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- 05 · trades */

function TradesMock() {
  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-panel border border-ink/8 bg-paper p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="label !text-[10px]">Proposal #14</p>
        <Tag tone="red">Locks in 2d 4h</Tag>
      </div>
      <div className="grid flex-1 grid-cols-[1fr_28px_1fr] items-start gap-2">
        <div className="rounded border border-ink/8 p-2">
          <p className="label mb-1.5 !text-[10px]">Warriors send</p>
          <div className="rounded bg-surface px-2 py-1.5 text-[13px] font-medium">
            J. Carter <Tag>G</Tag>
          </div>
        </div>
        <div className="num self-center text-center text-[13px] text-ink-faint">
          ⇄
        </div>
        <div className="rounded border border-ink/8 p-2">
          <p className="label mb-1.5 !text-[10px]">Hawks send</p>
          <div className="mb-1.5 rounded bg-surface px-2 py-1.5 text-[13px] font-medium">
            M. Brooks <Tag>F</Tag>
          </div>
          <div className="rounded bg-surface px-2 py-1.5 text-[13px] font-medium">
            S. Reed <Tag>G</Tag>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        {[
          ["Proposed", "done"],
          ["Countered", "done"],
          ["Commissioner review", "live"],
        ].map(([st, k], i) => (
          <span key={st as string} className="flex items-center gap-1.5">
            {i > 0 ? <span className="h-px w-4 bg-ink/20" /> : null}
            <span
              className={`num rounded px-2 py-1 text-[10px] ${
                k === "live"
                  ? "sr-breathe-chip bg-tint text-accent"
                  : "bg-ink/8 text-ink-muted"
              }`}
            >
              {st}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------- 06 · playoffs */

function BracketMock() {
  // Six seeds, two byes — exactly what the product generates for this league.
  const semi = [
    ["1 Warriors", "4 Suns", true],
    ["2 Titans", "3 Hawks", false],
  ] as const;
  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-panel border border-ink/8 bg-paper p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="label !text-[10px]">Seeded · byes to 1 &amp; 2</p>
        <Tag>Auto-advance on</Tag>
      </div>
      <div className="num mb-1 grid grid-cols-[1fr_20px_1fr_20px_1fr] gap-1 text-[10px] tracking-[0.1em] text-ink-faint">
        <span>QUARTERS</span>
        <span />
        <span>SEMIS</span>
        <span />
        <span>FINAL</span>
      </div>
      <div className="grid flex-1 grid-cols-[1fr_20px_1fr_20px_1fr] items-center gap-1">
        {/* quarters */}
        <div className="space-y-1.5">
          {[
            ["4 Suns", "5 Bolts", "18–12"],
            ["3 Hawks", "6 Owls", "21–15"],
          ].map(([a, b, s]) => (
            <div key={a} className="overflow-hidden rounded border border-ink/8 text-[11px]">
              <div className="flex justify-between border-b border-ink/6 px-2 py-1 font-medium">
                {a} <span className="num text-ink-faint">{s}</span>
              </div>
              <div className="flex justify-between px-2 py-1 text-ink-faint">
                {b} <span className="num">—</span>
              </div>
            </div>
          ))}
        </div>
        <div aria-hidden className="flex flex-col gap-8">
          <span className="sr-draw h-[2px] w-full bg-ink/30" />
          <span className="sr-draw h-[2px] w-full bg-ink/30" style={{ animationDelay: ".6s" }} />
        </div>
        {/* semis */}
        <div className="space-y-1.5">
          {semi.map(([a, b, hot]) => (
            <div
              key={a}
              className={`overflow-hidden rounded border text-[11px] ${
                hot ? "border-accent/40" : "border-ink/8"
              }`}
            >
              <div className={`flex justify-between border-b px-2 py-1 font-medium ${hot ? "border-accent/20 text-accent" : "border-ink/6"}`}>
                {a} <span className="num opacity-60">SAT</span>
              </div>
              <div className="flex justify-between px-2 py-1 text-ink-faint">
                {b} <span className="num">LUN A</span>
              </div>
            </div>
          ))}
        </div>
        <div aria-hidden className="flex flex-col">
          <span className="sr-draw h-[2px] w-full bg-accent" style={{ animationDelay: "1.2s" }} />
        </div>
        {/* final */}
        <div className="sr-champ rounded border border-accent/40 bg-tint px-2 py-3 text-center">
          <p className="label !text-[10px] !text-accent">Championship</p>
          <p className="num mt-1 text-[11px] text-accent">FRI · GYM 1</p>
        </div>
      </div>
      <div className="num mt-2 flex items-center justify-between rounded bg-surface px-2 py-1.5 text-[10px] text-ink-muted">
        <span>SEEDS FROM STANDINGS · H2H THEN DIFF TIEBREAK</span>
        <span className="hidden sm:inline">MVP BALLOT OPENS AFTER THE FINAL</span>
      </div>
    </div>
  );
}

/* ================================================================== cards */

type CardDef = {
  eyebrow: string;
  title: string;
  body: string;
  dark?: boolean;
  mock: (running: boolean) => React.ReactNode;
};

const CARDS: CardDef[] = [
  {
    eyebrow: "01 · Draft",
    title: "A real draft room",
    body: "Snake or linear, pick timer, auto-pick from your queue, rosters filling live. Fully usable from a phone in the hallway.",
    mock: () => <DraftMock />,
  },
  {
    eyebrow: "02 · Live stats",
    title: "Courtside stat tracking",
    body: "Two taps per event, undo anything. Works offline on gym Wi-Fi and syncs when you are back. Plus/minus computes itself.",
    dark: true,
    mock: (r) => <StatsMock running={r} />,
  },
  {
    eyebrow: "03 · Scheduling",
    title: "Knows the school day",
    body: "Games go into named slots — Lunch A, Free Period 6, After School — matched to when both teams actually have players free.",
    mock: () => <ScheduleMock />,
  },
  {
    eyebrow: "04 · Leaders",
    title: "Stats worth arguing about",
    body: "Box scores, shooting splits, leaderboards, career totals — updated the moment a game goes final.",
    mock: () => <LeadersMock />,
  },
  {
    eyebrow: "05 · Trades",
    title: "Trades with receipts",
    body: "Propose, counter, accept — commissioner approval or league vote, a deadline that locks it all, and a public transaction log.",
    mock: () => <TradesMock />,
  },
  {
    eyebrow: "06 · Playoffs",
    title: "Playoffs and a trophy",
    body: "Seeding from standings with real tiebreakers, live brackets that auto-advance, MVP and season awards at the end.",
    mock: () => <BracketMock />,
  },
];

/* ================================================================ section */

/** Stepped position: hold at each card, then a smoothstep transition. */
function stepped(p: number): number {
  const T = CARD_COUNT - 1;
  const HOLD = 0.42;
  const x = Math.min(0.9999, Math.max(0, p)) * T;
  const k = Math.floor(x);
  const f = x - k;
  if (f < HOLD) return k;
  const g = (f - HOLD) / (1 - HOLD);
  return k + g * g * (3 - 2 * g);
}

export default function SeasonRail() {
  const wrapRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [entered, setEntered] = useState(false);
  const [counter, setCounter] = useState(1);
  const reduced = useMedia(MOTION_QUERY);
  const desktop = useMedia(DESKTOP_QUERY);
  const pinning = desktop && !reduced;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        setInView(e.isIntersecting);
        if (e.isIntersecting) setEntered(true);
      },
      { rootMargin: "80px 0px", threshold: 0.02 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // The lock: scroll → stepped card position, with an assistive settle.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const cards = Array.from(
      stage.querySelectorAll<HTMLElement>(".sr-card"),
    );
    if (!pinning) {
      for (const c of cards) {
        c.style.transform = "";
        c.style.opacity = "";
      }
      return;
    }
    const wrap = wrapRef.current;
    if (!wrap) return;

    let raf = 0;
    let u = 0; // displayed position
    let lastScroll = 0;
    let lastT = performance.now();
    let offset = 0;
    let live = true;
    let wasPinned = false;

    const measure = () => {
      offset = (cards[0]?.offsetWidth ?? 0) + Math.round(innerWidth * 0.06);
    };

    const loop = (now: number) => {
      if (!live) return;
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      const r = wrap.getBoundingClientRect();
      const span = r.height - innerHeight;
      const p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
      const scrolling = now - lastScroll < 150;
      // While input flows, track it 1:1 (light smoothing = scrub feel).
      // Once it stops, settle onto the nearest card.
      const target = scrolling ? stepped(p) : Math.round(stepped(p));
      u += (target - u) * Math.min(1, dt * 11);
      if (Math.abs(target - u) < 0.0008) u = target;

      const isPinned = p > 0.001 && p < 0.999;
      if (isPinned !== wasPinned) {
        wasPinned = isPinned;
        stage.classList.toggle("sr-willchange", isPinned);
      }

      cards.forEach((card, i) => {
        const d = i - u;
        const a = Math.min(1, Math.abs(d));
        const x = d * offset;
        card.style.transform = `translate(-50%, -50%) translate3d(${x}px, 0, 0) scale(${1 - a * 0.08})`;
        card.style.opacity = String(Math.abs(d) > 1.7 ? 0 : 1 - a * 0.7);
      });
      const idx = Math.min(CARD_COUNT, Math.round(u) + 1);
      setCounter((c) => (c === idx ? c : idx));
      if (barRef.current) barRef.current.style.transform = `scaleX(${p})`;
      raf = requestAnimationFrame(loop);
    };

    const onScroll = () => {
      lastScroll = performance.now();
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      live = false;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      if (raf) cancelAnimationFrame(raf);
      stage.classList.remove("sr-willchange");
    };
  }, [pinning, inView]);

  const running = inView && !reduced;

  return (
    <section
      id="season"
      ref={wrapRef}
      className={`sr-wrap relative ${entered ? "sr-in" : ""} ${reduced ? "sr-reduced" : ""}`}
      style={pinning ? { height: `${100 + CARD_COUNT * 65}vh` } : undefined}
    >
      <div
        className={
          pinning
            ? "sticky top-0 flex h-screen flex-col justify-center overflow-hidden"
            : "py-20 sm:py-24"
        }
      >
        <div className="px-4 sm:px-6">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-end justify-between gap-x-8 gap-y-3">
            <h2
              aria-label="Everything a season needs"
              className="max-w-[24ch] text-[clamp(30px,3.6vw,52px)] font-semibold leading-[0.98] tracking-[-0.03em] text-white"
            >
              {"Everything a season needs".split(" ").map((w, i) => (
                <span key={i} aria-hidden className="mr-[0.26em] inline-block overflow-visible">
                  <span className="sr-word inline-block" style={{ animationDelay: `${i * 0.06}s` }}>
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

        {/* The stage: one card at a time when pinned; snap carousel on
            mobile; vertical stack under reduced motion. */}
        <div
          ref={stageRef}
          className={
            pinning
              ? "relative mt-6 h-[min(66vh,700px)]"
              : reduced
                ? "mx-auto mt-8 grid w-full max-w-7xl gap-5 px-4 sm:px-6"
                : "sr-snap mt-8 flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto px-4 pb-4 sm:px-6"
          }
        >
          {CARDS.map((c, i) => (
            <article
              key={c.eyebrow}
              tabIndex={0}
              className={`sr-card flex flex-col gap-3 rounded-card p-5 sm:p-6 ${
                c.dark ? "bg-ink text-white" : "card"
              } ${
                pinning
                  ? "absolute left-1/2 top-1/2 h-full w-[min(82vw,1180px)]"
                  : ""
              }`}
              style={
                pinning
                  ? {
                      transform: `translate(-50%, -50%) translate3d(${i * 110}vw, 0, 0)`,
                      opacity: i === 0 ? 1 : 0,
                    }
                  : undefined
              }
            >
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <p className={`label ${c.dark ? "!text-blush" : "!text-accent"}`}>
                  {c.eyebrow}
                </p>
                <h3 className="text-[clamp(19px,1.7vw,26px)] font-semibold leading-tight tracking-[-0.02em]">
                  {c.title}
                </h3>
              </div>
              <p
                className={`text-[13.5px] leading-snug ${
                  c.dark ? "text-white/60" : "text-ink-muted"
                }`}
              >
                {c.body}
              </p>
              {c.mock(running)}
            </article>
          ))}
        </div>

        {pinning ? (
          <div className="mt-6 flex items-center justify-center gap-4">
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
        .sr-willchange .sr-card { will-change: transform, opacity; }
        .sr-card { outline: none; transition: box-shadow .2s ease; }
        .sr-card:hover { box-shadow: 0 18px 50px rgb(23 23 26 / .16); }
        .sr-card:focus-visible { outline: 2px solid #c9242c; outline-offset: 3px; }
        .sr-snap .sr-card { scroll-snap-align: center; flex: 0 0 auto; width: 88vw; }
        .sr-reduced .sr-card { width: auto; }

        .sr-word, .sr-label { opacity: 0; }
        .sr-in .sr-word { animation: sr-word .8s cubic-bezier(.16,.84,.28,1) both; }
        .sr-in .sr-label { animation: sr-side .7s cubic-bezier(.16,.84,.28,1) .2s both; }
        @keyframes sr-word {
          from { opacity: 0; transform: translateY(40px); filter: blur(8px); }
          to { opacity: 1; transform: none; filter: blur(0); }
        }
        @keyframes sr-side {
          from { opacity: 0; transform: translateX(28px); }
          to { opacity: 1; transform: none; }
        }

        .sr-deplete {
          transform-origin: left center;
          animation: sr-deplete 8s linear infinite;
        }
        @keyframes sr-deplete { from { transform: scaleX(1); } to { transform: scaleX(0); } }
        .sr-flash { animation: sr-flash .55s ease-out both; }
        @keyframes sr-flash {
          0%, 45% { background-color: #c9242c; color: #fff; }
          100% { background-color: transparent; color: inherit; }
        }
        .sr-meter {
          transform-origin: left center;
          animation: sr-meter 5s ease-in-out infinite alternate;
        }
        @keyframes sr-meter { from { transform: scaleX(.94); } to { transform: scaleX(1); } }
        .sr-drop { animation: sr-drop 6s cubic-bezier(.16,.84,.28,1) infinite; }
        @keyframes sr-drop {
          0%, 12% { opacity: 0; transform: translateY(-8px); }
          20%, 100% { opacity: 1; transform: none; }
        }
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
        .sr-breathe-chip { animation: sr-breathe-chip 2.6s ease-in-out infinite; }
        @keyframes sr-breathe-chip {
          0%, 100% { background-color: #f7dcdc; }
          50% { background-color: #f3c9c9; }
        }

        section#season:not(.sr-in) [class*="sr-"] { animation-play-state: paused; }
        .sr-reduced [class*="sr-"] { animation: none !important; }
        .sr-reduced .sr-word, .sr-reduced .sr-label { opacity: 1; }
        @media (prefers-reduced-motion: reduce) {
          .sr-word, .sr-label { opacity: 1 !important; animation: none !important; }
          section#season [class*="sr-"] { animation: none !important; }
        }
      `}</style>
    </section>
  );
}
