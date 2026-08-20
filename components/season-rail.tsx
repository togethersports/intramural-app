"use client";

/**
 * "Everything a season needs" — six screens of the actual product, pinned,
 * one at a time. Each card is an application window: titlebar with the mark,
 * breadcrumb, season selector and avatars; a left nav sidebar (collapsed to
 * icons below xl, a bottom tab bar on phones); a contextual toolbar; a
 * status bar. The eyebrow and headline sit above the window as page-level
 * context, white on the Court Blue ground.
 *
 * The pin: sticky stage in a tall wrapper, scroll → stepped card position
 * with a hold at every card, a light settle onto the nearest card when
 * input pauses, and a deliberate extra dwell on card 01 and card 06 (about
 * 45% of one card's allotment at each end) so neither edge card is skipped.
 * During those dwells the active card drifts a few pixels with scroll and
 * the progress bar keeps moving — feedback, never a freeze.
 *
 * transform/opacity only, translate3d, will-change only while pinned.
 * <900px: no pin, native scroll-snap carousel, side panels hidden per
 * screen. Reduced motion: vertical stack, all loops dead. Loops pause via
 * IntersectionObserver. Everything interactive-looking is a real button.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  IconCalendar,
  IconChart,
  IconGrid,
  IconSearch,
  IconTicket,
  IconTrophy,
  IconUser,
  IconWhistle,
} from "@/components/icons";
import { Mark } from "@/components/mark";

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
/** Extra dwell on cards 01 and 06, as a fraction of one card's allotment. */
const END_DWELL = 0.45;

/* ================================================================ shared */

function Tag({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "red" | "dark";
}) {
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

const NAV = [
  { key: "dash", label: "Dashboard", icon: IconGrid },
  { key: "draft", label: "Draft", icon: IconWhistle },
  { key: "sched", label: "Schedule", icon: IconCalendar },
  { key: "stats", label: "Stats", icon: IconChart },
  { key: "trades", label: "Trades", icon: IconTicket },
  { key: "playoffs", label: "Playoffs", icon: IconTrophy },
] as const;

/**
 * The application window. Titlebar / sidebar / toolbar / content / status
 * bar. `dark` flips the chrome for the courtside screen. On phones the
 * sidebar becomes a bottom tab bar.
 */
function AppFrame({
  active,
  crumb,
  toolbar,
  records,
  hint,
  dark,
  children,
}: {
  active: (typeof NAV)[number]["key"];
  crumb: string;
  toolbar: React.ReactNode;
  records: string;
  hint: string;
  dark?: boolean;
  children: React.ReactNode;
}) {
  const line = dark ? "border-white/10" : "border-ink/8";
  const dim = dark ? "text-white/50" : "text-ink-faint";
  const body = dark ? "text-white/85" : "text-ink-body";
  return (
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-panel border ${line} ${
        dark ? "bg-ink text-white" : "bg-surface"
      }`}
    >
      {/* titlebar */}
      <div className={`flex items-center gap-3 border-b ${line} px-3 py-2`}>
        <Mark size={14} tone={dark ? "white-red" : "ink"} />
        <span className={`truncate text-[12px] font-medium ${body}`}>
          Warriors League <span className={dim}>/</span> {crumb}
        </span>
        <span className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className={`num hidden rounded border px-2 py-0.5 text-[10px] sm:block ${line} ${dim}`}
          >
            Winter 26 ▾
          </button>
          <span className="hidden items-center -space-x-1.5 sm:flex">
            {["JC", "MB", "SR"].map((a) => (
              <span
                key={a}
                className={`grid size-5 place-items-center rounded-full border text-[8px] font-semibold ${
                  dark
                    ? "border-ink bg-white/90 text-ink"
                    : "border-surface bg-ink text-white"
                }`}
              >
                {a}
              </span>
            ))}
          </span>
          <span aria-hidden className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`size-2 rounded-full ${dark ? "bg-white/20" : "bg-ink/15"}`}
              />
            ))}
          </span>
        </span>
      </div>
      {/* toolbar */}
      <div
        className={`flex items-center gap-2 overflow-hidden border-b ${line} px-3 py-1.5`}
      >
        {toolbar}
      </div>
      {/* sidebar + content */}
      <div className="flex min-h-0 flex-1">
        <nav
          aria-label="App sections"
          className={`hidden w-9 shrink-0 flex-col gap-0.5 border-r ${line} p-1.5 sm:flex xl:w-36`}
        >
          {NAV.map((n) => (
            <span
              key={n.key}
              className={`flex items-center gap-2 rounded-[8px] px-1.5 py-1.5 text-[11.5px] font-medium ${
                n.key === active
                  ? "bg-tint text-accent"
                  : dark
                    ? "text-white/55"
                    : "text-ink-muted"
              }`}
            >
              <n.icon size={13} className="shrink-0" />
              <span className="hidden xl:inline">{n.label}</span>
            </span>
          ))}
          <span
            className={`mt-auto flex items-center gap-2 rounded-[8px] px-1.5 py-1.5 text-[11.5px] font-medium ${dark ? "text-white/55" : "text-ink-muted"}`}
          >
            <IconUser size={13} className="shrink-0" />
            <span className="hidden xl:inline">Settings</span>
          </span>
        </nav>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col p-2.5">
          {children}
        </div>
      </div>
      {/* mobile tab bar */}
      <div className={`flex justify-around border-t ${line} py-1.5 sm:hidden`}>
        {NAV.slice(0, 5).map((n) => (
          <n.icon
            key={n.key}
            size={15}
            className={n.key === active ? "text-accent" : dim}
          />
        ))}
      </div>
      {/* status bar */}
      <div
        className={`num hidden items-center gap-3 border-t ${line} px-3 py-1 text-[9.5px] tracking-[0.06em] sm:flex ${dim}`}
      >
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-bench" />
          CONNECTED
        </span>
        <span>SYNCED 12S AGO</span>
        <span>{records}</span>
        <span className="ml-auto">{hint}</span>
      </div>
    </div>
  );
}

function Panel({
  title,
  right,
  dark,
  className,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  dark?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex min-h-0 flex-col overflow-hidden rounded-[10px] border p-2 ${
        dark ? "border-white/10 bg-white/5" : "border-ink/8 bg-paper"
      } ${className ?? ""}`}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <p className="label !text-[9.5px]">{title}</p>
        {right}
      </div>
      {children}
    </div>
  );
}

/* Toolbar bits */
function Search({ dark }: { dark?: boolean }) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] ${
        dark ? "border-white/15 text-white/45" : "border-ink/10 text-ink-faint"
      }`}
    >
      <IconSearch size={11} /> Search…
    </span>
  );
}
function ToolBtn({
  children,
  primary,
  dark,
}: {
  children: React.ReactNode;
  primary?: boolean;
  dark?: boolean;
}) {
  return (
    <button
      type="button"
      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium ${
        primary
          ? dark
            ? "bg-white text-ink"
            : "bg-ink text-white"
          : dark
            ? "border border-white/15 text-white/70"
            : "border border-ink/10 text-ink-muted"
      }`}
    >
      {children}
    </button>
  );
}
function Overflow({ dark }: { dark?: boolean }) {
  return (
    <button
      type="button"
      aria-label="More"
      className={`ml-auto rounded px-1.5 text-[13px] leading-none ${dark ? "text-white/50" : "text-ink-faint"}`}
    >
      ⋯
    </button>
  );
}

/* ============================================================ 01 · draft */

function DraftScreen() {
  const [mode, setMode] = useState<"snake" | "linear">("snake");
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
      <div className="flex min-h-0 flex-col gap-2">
        <Panel
          title="Round 1"
          right={
            <div className="flex gap-1">
              {(["snake", "linear"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  className={`num rounded px-1.5 py-0.5 text-[9px] uppercase ${
                    mode === m ? "bg-ink text-white" : "bg-ink/8 text-ink-muted"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          }
        >
          {[
            ["1.01", "J. Carter", "WAR", "done"],
            ["1.02", "M. Brooks", "TIT", "done"],
            ["1.03", "On the clock…", "HAW", "live"],
            ["1.04", "—", "SUN", "next"],
            ["1.05", "—", "BOL", "next"],
            ["1.06", "—", "OWL", "next"],
          ].map(([no, who, team, st]) => (
            <div
              key={no as string}
              className={`sr-row grid grid-cols-[34px_1fr_auto] items-center gap-1.5 border-b border-ink/6 py-1.5 text-[12px] last:border-0 ${
                st === "live"
                  ? "text-accent"
                  : st === "next"
                    ? "text-ink-faint"
                    : ""
              }`}
            >
              <span className="num text-[10px] opacity-70">{no}</span>
              <span className={st === "done" ? "font-medium" : ""}>{who}</span>
              <span className="num text-[10px] opacity-70">{team}</span>
            </div>
          ))}
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-tint">
            <div className="sr-deplete h-full w-full rounded-full bg-accent" />
          </div>
        </Panel>
        <Panel title="Clock history" className="hidden flex-1 sm:flex">
          {[
            ["1.01", "0:42"],
            ["1.02", "1:13"],
          ].map(([n, t]) => (
            <div
              key={n}
              className="num flex justify-between border-b border-ink/6 py-1 text-[11px] text-ink-muted"
            >
              <span>{n}</span>
              <span>{t}</span>
            </div>
          ))}
          <div className="num mt-auto flex justify-between pt-1 text-[9.5px] text-ink-faint">
            <span>AVG 0:58</span>
            <span>LIMIT 2:00</span>
          </div>
        </Panel>
      </div>
      <div className="hidden min-h-0 flex-col gap-2 sm:flex">
        <Panel title="My queue" right={<Tag>Auto on</Tag>}>
          {[
            ["S. Reed", "G"],
            ["R. Hayes", "F"],
            ["D. Miller", "C"],
            ["A. Cole", "G"],
          ].map(([who, pos], i) => (
            <div
              key={who}
              className="sr-row grid grid-cols-[10px_1fr_auto_auto] items-center gap-1.5 border-b border-ink/6 py-1.5 text-[12px] last:border-0"
            >
              <span aria-hidden className="flex flex-col gap-[2.5px]">
                <span className="h-px w-2.5 bg-ink/25" />
                <span className="h-px w-2.5 bg-ink/25" />
                <span className="h-px w-2.5 bg-ink/25" />
              </span>
              <span>{who}</span>
              <Tag>{pos}</Tag>
              <span className="num text-[10px] text-ink-faint">{i + 1}</span>
            </div>
          ))}
        </Panel>
        <Panel title="The board" className="flex-1">
          <div className="num grid flex-1 grid-cols-3 gap-1 text-[9.5px] text-ink-muted">
            {["WAR", "TIT", "HAW", "SUN", "BOL", "OWL"].map((t, i) => (
              <div key={t} className="rounded border border-ink/8 p-1">
                <p className="font-medium text-ink">{t}</p>
                <p className="truncate">
                  {["Carter", "Brooks", "…", "—", "—", "—"][i]}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel title="Draft feed" className="hidden sm:flex">
        {[
          ["12:04", "Titans select M. Brooks"],
          ["12:03", "Coach P — good value there"],
          ["12:03", "Warriors select J. Carter"],
          ["12:01", "Pick clock set to 2:00"],
          ["12:00", "Draft started · 6 teams"],
        ].map(([t, m], i) => (
          <div
            key={i}
            className="border-b border-ink/6 py-1.5 text-[11.5px] last:border-0"
          >
            <span className="num mr-1.5 text-[9.5px] text-ink-faint">{t}</span>
            <span className={i === 1 ? "text-ink-muted" : ""}>{m}</span>
          </div>
        ))}
        <div className="mt-auto rounded border border-ink/10 px-2 py-1.5 text-[11px] text-ink-faint">
          Message the room…
        </div>
      </Panel>
    </div>
  );
}

/* ======================================================== 02 · live stats */

const STAT_KEYS = ["2PT", "3PT", "REB", "AST", "STL", "BLK", "TO", "PF"];
const BOX_BASE = [
  { name: "Carter", pts: 12, reb: 5, ast: 3, pm: 6 },
  { name: "Brooks", pts: 9, reb: 7, ast: 2, pm: -2 },
  { name: "Reed", pts: 7, reb: 2, ast: 5, pm: 4 },
  { name: "Hayes", pts: 4, reb: 6, ast: 1, pm: 1 },
];

function StatsScreen({ running }: { running: boolean }) {
  const [lit, setLit] = useState(-1);
  const [tick, setTick] = useState(0);
  const [box, setBox] = useState(BOX_BASE);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const key = Math.floor(Math.random() * 7); // PF stays resting-red
      setLit(key);
      setTick((t) => t + 1);
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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="num grid grid-cols-5 gap-1 text-[10px]">
        {[
          ["Q1", "18–14"],
          ["Q2", "12–9"],
          ["Q3", "15–11"],
          ["Q4", "· LIVE"],
          ["T", "45–34"],
        ].map(([q, s], i) => (
          <div
            key={q}
            className={`rounded border px-1.5 py-1 text-center ${
              i === 3
                ? "border-accent/40 text-accent"
                : "border-white/10 text-white/70"
            }`}
          >
            <span className="mr-1 opacity-60">{q}</span>
            {s}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[1fr_1.25fr]">
        <div className="num grid auto-rows-fr grid-cols-4 gap-1.5 text-[11px]">
          {STAT_KEYS.map((e, i) => (
            <button
              type="button"
              key={`${e}-${lit === i ? tick : "idle"}`}
              className={`grid place-items-center rounded-[8px] ${
                i === 7
                  ? "bg-accent text-white"
                  : "border border-white/20 text-white/90"
              } ${lit === i ? "sr-flash" : ""}`}
            >
              {e}
            </button>
          ))}
        </div>
        <div className="flex min-h-0 flex-col gap-2">
          <Panel title="Box score" dark right={<Tag tone="red">LIVE</Tag>}>
            <div className="num grid grid-cols-[1fr_repeat(4,38px)] gap-1 border-b border-white/15 pb-1 text-[9px] tracking-[0.1em] text-white/50">
              <span>PLAYER</span>
              <span className="text-right">PTS</span>
              <span className="text-right">REB</span>
              <span className="text-right">AST</span>
              <span className="text-right">+/−</span>
            </div>
            {box.map((r, i) => (
              <div
                key={r.name}
                className={`num sr-row grid grid-cols-[1fr_repeat(4,38px)] gap-1 py-1 text-[11px] text-white/90 ${
                  i < box.length - 1 ? "border-b border-white/8" : ""
                }`}
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
          </Panel>
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
            <Panel title="Event log" dark>
              {[
                ["07:42", "Carter 3PT"],
                ["07:12", "Brooks REB"],
                ["06:58", "SUB Reed in"],
              ].map(([t, m]) => (
                <div
                  key={t}
                  className="num border-b border-white/8 py-1 text-[10px] text-white/70 last:border-0"
                >
                  <span className="mr-1.5 text-white/40">{t}</span>
                  {m}
                </div>
              ))}
            </Panel>
            <Panel title="On court" dark right={<Tag tone="dark">SUB</Tag>}>
              <div className="flex flex-wrap gap-1">
                {["JC", "MB", "SR", "RH", "DM"].map((p) => (
                  <span
                    key={p}
                    className="grid size-6 place-items-center rounded-full bg-white/90 text-[8px] font-semibold text-ink"
                  >
                    {p}
                  </span>
                ))}
              </div>
              <p className="num mt-auto pt-1 text-[9px] text-white/40">
                BENCH · COLE NASH OSEI
              </p>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ======================================================= 03 · scheduling */

function SchedScreen() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const slots = ["Lunch A", "Free 6", "After Sch"];
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
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[1.7fr_1fr]">
        <Panel title="Week 5" right={<Tag tone="red">1 conflict</Tag>}>
          <div
            className="grid flex-1 gap-1"
            style={{ gridTemplateColumns: "54px repeat(5, 1fr)" }}
          >
            <span />
            {days.map((d, i) => (
              <span
                key={d}
                className={`label !text-[9px] text-center ${i > 2 ? "hidden sm:block" : ""}`}
              >
                {d}
              </span>
            ))}
            {slots.map((s, r) => (
              <>
                <span key={s} className="label self-center !text-[9px]">
                  {s}
                </span>
                {days.map((d, c) => {
                  const g = games[`${r}-${c}`];
                  return (
                    <div
                      key={`${r}-${c}`}
                      className={`relative min-h-9 rounded ${c > 2 ? "hidden sm:block" : ""}`}
                      style={{
                        backgroundColor: `rgb(78 124 168 / ${0.06 + heat[r][c] * 0.07})`,
                      }}
                    >
                      {g ? (
                        <div
                          className={`absolute inset-0.5 flex flex-col justify-center rounded bg-bench px-1 text-white ${
                            r === 2 && c === 4 ? "sr-drop" : ""
                          }`}
                        >
                          <span className="num text-[9px] leading-tight">
                            {g[0]}
                          </span>
                          <span className="text-[8px] leading-tight opacity-80">
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
          <p className="num mt-1.5 text-[9px] text-ink-faint">
            SHADE = PLAYERS FREE · DARKER IS BETTER
          </p>
        </Panel>
        <div className="hidden min-h-0 flex-col gap-2 sm:flex">
          <Panel title="Gym availability">
            {[
              ["Gym 1", 72],
              ["Gym 2", 45],
              ["Half-court", 88],
            ].map(([g, v]) => (
              <div key={g as string} className="mb-1.5 last:mb-0">
                <div className="num mb-0.5 flex justify-between text-[10px] text-ink-muted">
                  <span>{g}</span>
                  <span>{v}% free</span>
                </div>
                <div className="h-1 rounded-full bg-ink/8">
                  <div
                    className="h-full rounded-full bg-bench"
                    style={{ width: `${v}%` }}
                  />
                </div>
              </div>
            ))}
          </Panel>
          <Panel title="Conflicts" className="flex-1">
            <div className="sr-row flex items-center justify-between border-b border-ink/6 py-1.5 text-[11px]">
              <span>
                <Tag tone="red">Free 6 Thu</Tag>
                <span className="ml-1.5 text-ink-muted">
                  3 Hawks unavailable
                </span>
              </span>
              <ToolBtn>Resolve</ToolBtn>
            </div>
            <div className="sr-row flex items-center justify-between py-1.5 text-[11px]">
              <span className="text-ink-muted">No other conflicts</span>
            </div>
          </Panel>
        </div>
      </div>
      <div className="hidden items-center gap-2 sm:flex">
        <Tag>Draft · 3 unpublished changes</Tag>
        <span className="ml-auto flex gap-1.5">
          <ToolBtn>Notify players</ToolBtn>
          <ToolBtn primary>Publish week</ToolBtn>
        </span>
      </div>
    </div>
  );
}

/* ========================================================== 04 · leaders */

const LEADER_COLS = ["PPG", "RPG", "APG", "FG%"] as const;
const LEADERS = [
  { name: "J. Carter", team: "WAR", vals: [19.5, 6.2, 3.1, 54] },
  { name: "M. Brooks", team: "TIT", vals: [16.0, 8.4, 2.2, 48] },
  { name: "S. Reed", team: "HAW", vals: [12.8, 3.9, 6.5, 44] },
  { name: "R. Hayes", team: "SUN", vals: [11.2, 7.1, 1.8, 51] },
];

function LeadersScreen() {
  const [col, setCol] = useState(0);
  const [span, setSpan] = useState<"season" | "career">("season");
  const max = Math.max(...LEADERS.map((l) => l.vals[col]));
  const rows = [...LEADERS].sort((a, b) => b.vals[col] - a.vals[col]);
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[1.4fr_1fr]">
      <Panel
        title="Leaders"
        right={
          <div className="flex gap-1">
            {(["season", "career"] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={span === s}
                onClick={() => setSpan(s)}
                className={`num rounded px-1.5 py-0.5 text-[9px] uppercase ${
                  span === s ? "bg-ink text-white" : "bg-ink/8 text-ink-muted"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        }
      >
        <div className="num mb-1 flex justify-end gap-1 text-[9.5px]">
          {LEADER_COLS.map((c, i) => (
            <button
              key={c}
              type="button"
              aria-pressed={col === i}
              onClick={() => setCol(i)}
              className={`rounded px-1.5 py-0.5 ${col === i ? "bg-tint text-accent" : "text-ink-muted"}`}
            >
              {c}
              {col === i ? " ▾" : ""}
            </button>
          ))}
        </div>
        {rows.map((l, i) => (
          <div
            key={l.name}
            className="sr-row grid grid-cols-[16px_22px_1fr_auto] items-center gap-1.5 border-b border-ink/6 py-1.5 last:border-0"
          >
            <span className="num text-[10px] text-ink-faint">{i + 1}</span>
            <span className="grid size-5 place-items-center rounded-full bg-ink text-[8px] font-semibold text-white">
              {l.name.split(" ")[1].slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[12px] font-medium">
                {l.name}{" "}
                <span className="num text-[9px] text-ink-faint">{l.team}</span>
              </span>
              <span className="mt-0.5 block h-[4px] rounded-full bg-tint">
                <span
                  className="sr-meter block h-full rounded-full bg-accent"
                  style={{
                    width: `${(l.vals[col] / max) * 100}%`,
                    animationDelay: `${i * 0.6}s`,
                  }}
                />
              </span>
            </span>
            <span className="num text-[12px]">
              {l.vals[col]}
              {col === 3 ? "%" : ""}
            </span>
          </div>
        ))}
      </Panel>
      <div className="hidden min-h-0 flex-col gap-2 sm:flex">
        <Panel title="Carter · shot chart" right={<Tag>Last 5</Tag>}>
          <div className="relative h-16 overflow-hidden rounded border border-ink/8">
            <div className="absolute inset-x-6 -top-8 h-16 rounded-b-full border border-ink/10" />
            {[
              [22, 55, 1],
              [38, 30, 1],
              [55, 62, 0],
              [68, 38, 1],
              [80, 58, 0],
              [45, 15, 1],
              [12, 30, 0],
              [88, 25, 1],
            ].map(([x, y, made], i) => (
              <span
                key={i}
                className={`absolute size-1.5 rounded-full ${made ? "bg-accent" : "border border-ink/40"}`}
                style={{ left: `${x}%`, top: `${y}%` }}
              />
            ))}
          </div>
          <div className="num mt-1 flex justify-between text-[9px] text-ink-faint">
            <span>● MADE</span>
            <span>○ MISS</span>
            <span>EFG 57%</span>
          </div>
        </Panel>
        <Panel title="Game log" className="flex-1">
          <div className="num grid grid-cols-[1fr_repeat(3,30px)] gap-1 border-b border-ink/10 pb-0.5 text-[8.5px] tracking-[0.1em] text-ink-faint">
            <span>GAME</span>
            <span className="text-right">PTS</span>
            <span className="text-right">REB</span>
            <span className="text-right">AST</span>
          </div>
          {[
            ["vs HAW", 22, 5, 4],
            ["at TIT", 18, 7, 2],
            ["vs SUN", 25, 4, 5],
            ["at BOL", 14, 6, 3],
          ].map(([g, p, r, a]) => (
            <div
              key={g as string}
              className="num sr-row grid grid-cols-[1fr_repeat(3,30px)] gap-1 border-b border-ink/6 py-1 text-[10.5px] last:border-0"
            >
              <span className="font-sans">{g}</span>
              <span className="text-right">{p}</span>
              <span className="text-right">{r}</span>
              <span className="text-right">{a}</span>
            </div>
          ))}
          <svg
            aria-hidden
            viewBox="0 0 100 20"
            className="mt-auto h-5 w-full"
            preserveAspectRatio="none"
          >
            <polyline
              points="0,12 20,8 40,14 60,4 80,10 100,6"
              fill="none"
              stroke="#c9242c"
              strokeWidth="1.5"
            />
          </svg>
        </Panel>
      </div>
    </div>
  );
}

/* =========================================================== 05 · trades */

function TradesScreen() {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[1.4fr_1fr]">
      <div className="flex min-h-0 flex-col gap-2">
        <Panel title="Proposal #14" right={<Tag tone="red">Locks in 2d 4h</Tag>}>
          <div className="grid grid-cols-[1fr_22px_1fr] items-start gap-1.5">
            <div className="rounded border border-ink/8 p-1.5">
              <p className="label mb-1 !text-[9px]">Warriors send</p>
              <div className="rounded bg-surface px-1.5 py-1 text-[11.5px] font-medium">
                J. Carter <Tag>G</Tag>
              </div>
            </div>
            <div className="num self-center text-center text-[12px] text-ink-faint">
              ⇄
            </div>
            <div className="rounded border border-ink/8 p-1.5">
              <p className="label mb-1 !text-[9px]">Hawks send</p>
              <div className="mb-1 rounded bg-surface px-1.5 py-1 text-[11.5px] font-medium">
                M. Brooks <Tag>F</Tag>
              </div>
              <div className="rounded bg-surface px-1.5 py-1 text-[11.5px] font-medium">
                S. Reed <Tag>G</Tag>
              </div>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1">
            {[
              ["Proposed", "done"],
              ["Countered", "done"],
              ["Commissioner review", "live"],
            ].map(([st, k], i) => (
              <span key={st as string} className="flex items-center gap-1">
                {i > 0 ? <span className="h-px w-3 bg-ink/20" /> : null}
                <span
                  className={`num rounded px-1.5 py-0.5 text-[9px] ${
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
        </Panel>
        <Panel title="Roster impact" className="hidden flex-1 sm:flex">
          <div className="num grid flex-1 grid-cols-2 gap-1.5 text-[10px]">
            <div className="rounded border border-ink/8 p-1.5">
              <p className="mb-0.5 font-sans text-[10.5px] font-medium">
                Warriors
              </p>
              <p className="text-ink-muted">PPG 61.2 → 58.9</p>
              <p className="text-ink-muted">AST 12.4 → 14.1</p>
            </div>
            <div className="rounded border border-ink/8 p-1.5">
              <p className="mb-0.5 font-sans text-[10.5px] font-medium">Hawks</p>
              <p className="text-ink-muted">PPG 54.0 → 56.3</p>
              <p className="text-ink-muted">REB 22.1 → 20.4</p>
            </div>
          </div>
        </Panel>
      </div>
      <div className="hidden min-h-0 flex-col gap-2 sm:flex">
        <Panel title="Captain vote">
          <div className="num mb-1 flex justify-between text-[10px] text-ink-muted">
            <span>FOR 4</span>
            <span>AGAINST 2</span>
          </div>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-tint">
            <div className="h-full bg-ink" style={{ width: "66%" }} />
          </div>
        </Panel>
        <Panel title="Transaction log" className="flex-1">
          {[
            ["Jan 12", "Bolts send Miller to Suns", "approved"],
            ["Jan 08", "Owls claim A. Cole", "approved"],
            ["Jan 03", "Titans–Hawks 2-for-1", "vetoed"],
          ].map(([d, m, st]) => (
            <div
              key={m as string}
              className="sr-row border-b border-ink/6 py-1.5 text-[10.5px] last:border-0"
            >
              <span className="num mr-1.5 text-[9px] text-ink-faint">{d}</span>
              {m}{" "}
              <Tag tone={st === "vetoed" ? "red" : undefined}>{st}</Tag>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

/* ========================================================= 06 · playoffs */

function PlayoffsScreen() {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[1.5fr_1fr]">
      <Panel title="Bracket · byes to 1 & 2" right={<Tag>Auto-advance</Tag>}>
        <div className="num mb-1 grid grid-cols-[1fr_16px_1fr_16px_1fr] gap-1 text-[8.5px] tracking-[0.1em] text-ink-faint">
          <span>QUARTERS</span>
          <span />
          <span>SEMIS</span>
          <span />
          <span>FINAL</span>
        </div>
        <div className="grid flex-1 grid-cols-[1fr_16px_1fr_16px_1fr] items-center gap-1">
          <div className="space-y-1.5">
            {[
              ["4 Suns", "5 Bolts", "18–12"],
              ["3 Hawks", "6 Owls", "21–15"],
            ].map(([a, b, s]) => (
              <div
                key={a}
                className="overflow-hidden rounded border border-ink/8 text-[10px]"
              >
                <div className="flex justify-between border-b border-ink/6 px-1.5 py-0.5 font-medium">
                  {a} <span className="num text-ink-faint">{s}</span>
                </div>
                <div className="flex justify-between px-1.5 py-0.5 text-ink-faint">
                  {b} <span className="num">—</span>
                </div>
              </div>
            ))}
          </div>
          <div aria-hidden className="flex flex-col gap-6">
            <span className="sr-draw h-[2px] w-full bg-ink/30" />
            <span
              className="sr-draw h-[2px] w-full bg-ink/30"
              style={{ animationDelay: ".6s" }}
            />
          </div>
          <div className="space-y-1.5">
            {[
              ["1 Warriors", "4 Suns", true],
              ["2 Titans", "3 Hawks", false],
            ].map(([a, b, hot]) => (
              <div
                key={a as string}
                className={`overflow-hidden rounded border text-[10px] ${hot ? "border-accent/40" : "border-ink/8"}`}
              >
                <div
                  className={`flex justify-between border-b px-1.5 py-0.5 font-medium ${
                    hot ? "border-accent/20 text-accent" : "border-ink/6"
                  }`}
                >
                  {a} <span className="num opacity-60">SAT</span>
                </div>
                <div className="flex justify-between px-1.5 py-0.5 text-ink-faint">
                  {b} <span className="num">LUN A</span>
                </div>
              </div>
            ))}
          </div>
          <div aria-hidden>
            <span
              className="sr-draw block h-[2px] w-full bg-accent"
              style={{ animationDelay: "1.2s" }}
            />
          </div>
          <div className="sr-champ rounded border border-accent/40 bg-tint px-1.5 py-2 text-center">
            <p className="label !text-[9px] !text-accent">Championship</p>
            <p className="num mt-0.5 text-[10px] text-accent">FRI · GYM 1</p>
          </div>
        </div>
      </Panel>
      <div className="hidden min-h-0 flex-col gap-2 sm:flex">
        <Panel title="Seeding">
          <div className="num grid grid-cols-[16px_1fr_34px_34px] gap-1 border-b border-ink/10 pb-0.5 text-[8.5px] tracking-[0.1em] text-ink-faint">
            <span>#</span>
            <span>TEAM</span>
            <span className="text-right">W–L</span>
            <span className="text-right">DIFF</span>
          </div>
          {[
            ["1", "Warriors", "8–2", "+64"],
            ["2", "Titans", "7–3", "+41"],
            ["3", "Hawks", "6–4", "+18"],
            ["4", "Suns", "5–5", "−2"],
          ].map(([n, t, wl, d]) => (
            <div
              key={t}
              className="num sr-row grid grid-cols-[16px_1fr_34px_34px] gap-1 border-b border-ink/6 py-1 text-[10.5px] last:border-0"
            >
              <span className="text-ink-faint">{n}</span>
              <span className="font-sans font-medium">{t}</span>
              <span className="text-right">{wl}</span>
              <span className="text-right">{d}</span>
            </div>
          ))}
        </Panel>
        <Panel title="Tiebreak · 2 vs 3">
          <p className="num text-[10px] text-ink-muted">H2H · TITANS 2–0</p>
          <p className="num text-[10px] text-ink-muted">DIFF · +41 vs +18</p>
        </Panel>
        <Panel title="MVP ballot" className="flex-1" right={<Tag>Open</Tag>}>
          {[
            ["J. Carter", 9],
            ["M. Brooks", 6],
            ["S. Reed", 3],
          ].map(([n, v]) => (
            <div
              key={n as string}
              className="sr-row flex items-center justify-between border-b border-ink/6 py-1 text-[10.5px] last:border-0"
            >
              <span>{n}</span>
              <span className="num text-ink-muted">{v} votes</span>
            </div>
          ))}
        </Panel>
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
  nav: (typeof NAV)[number]["key"];
  crumb: string;
  records: string;
  hint: string;
  toolbar: (dark?: boolean) => React.ReactNode;
  screen: (running: boolean) => React.ReactNode;
};

const CARDS: CardDef[] = [
  {
    eyebrow: "01 · Draft",
    title: "A real draft room",
    body: "Snake or linear, pick timer, auto-pick from your queue, rosters filling live. Fully usable from a phone in the hallway.",
    nav: "draft",
    crumb: "Draft Room",
    records: "6 TEAMS · 36 PLAYERS",
    hint: "⌘Z UNDO · ⌘K SEARCH",
    toolbar: () => (
      <>
        <Search />
        <ToolBtn>Round 1 ▾</ToolBtn>
        <ToolBtn primary>Pause draft</ToolBtn>
        <Overflow />
      </>
    ),
    screen: () => <DraftScreen />,
  },
  {
    eyebrow: "02 · Live stats",
    title: "Courtside stat tracking",
    body: "Two taps per event, undo anything. Works offline on gym Wi-Fi and syncs when you are back. Plus/minus computes itself.",
    dark: true,
    nav: "stats",
    crumb: "Tracker · WAR vs HAW",
    records: "47 EVENTS · ALL REVERSIBLE",
    hint: "TAP TWICE · ⌘Z UNDO",
    toolbar: () => (
      <>
        <span className="num flex items-center gap-1.5 text-[11px] text-white">
          <span className="size-1.5 rounded-full bg-accent lp-blip" />
          Q4 · 2:14
        </span>
        <ToolBtn dark>Undo</ToolBtn>
        <ToolBtn dark>Lineup</ToolBtn>
        <span className="num ml-auto rounded bg-white/10 px-2 py-1 text-[10px] text-white/80">
          SYNCED
        </span>
      </>
    ),
    screen: (r) => <StatsScreen running={r} />,
  },
  {
    eyebrow: "03 · Scheduling",
    title: "Knows the school day",
    body: "Games go into named slots — Lunch A, Free Period 6, After School — matched to when both teams actually have players free.",
    nav: "sched",
    crumb: "Schedule · Week 5",
    records: "4 GAMES · 2 GYMS",
    hint: "DRAG TO MOVE",
    toolbar: () => (
      <>
        <Search />
        <ToolBtn>Week 5 ▾</ToolBtn>
        <ToolBtn>Heatmap on</ToolBtn>
        <ToolBtn primary>Auto-schedule</ToolBtn>
        <Overflow />
      </>
    ),
    screen: () => <SchedScreen />,
  },
  {
    eyebrow: "04 · Leaders",
    title: "Stats worth arguing about",
    body: "Box scores, shooting splits, leaderboards, career totals — updated the moment a game goes final.",
    nav: "stats",
    crumb: "Stats · Leaders",
    records: "24 PLAYERS RANKED",
    hint: "CLICK HEADERS TO SORT",
    toolbar: () => (
      <>
        <Search />
        <ToolBtn>All teams ▾</ToolBtn>
        <ToolBtn>Min. 3 games</ToolBtn>
        <ToolBtn primary>Export</ToolBtn>
        <Overflow />
      </>
    ),
    screen: () => <LeadersScreen />,
  },
  {
    eyebrow: "05 · Trades",
    title: "Trades with receipts",
    body: "Propose, counter, accept — commissioner approval or league vote, a deadline that locks it all, and a public transaction log.",
    nav: "trades",
    crumb: "Trade Center",
    records: "1 OPEN · 3 SETTLED",
    hint: "DEADLINE FRI 3:30",
    toolbar: () => (
      <>
        <Search />
        <ToolBtn>Open ▾</ToolBtn>
        <ToolBtn primary>Propose trade</ToolBtn>
        <Overflow />
      </>
    ),
    screen: () => <TradesScreen />,
  },
  {
    eyebrow: "06 · Playoffs",
    title: "Playoffs and a trophy",
    body: "Seeding from standings with real tiebreakers, live brackets that auto-advance, MVP and season awards at the end.",
    nav: "playoffs",
    crumb: "Playoffs",
    records: "6 SEEDS · 2 BYES",
    hint: "BALLOTS CLOSE FRI",
    toolbar: () => (
      <>
        <Search />
        <ToolBtn>Bracket ▾</ToolBtn>
        <ToolBtn>Reseed</ToolBtn>
        <ToolBtn primary>Publish bracket</ToolBtn>
        <Overflow />
      </>
    ),
    screen: () => <PlayoffsScreen />,
  },
];

/* ================================================================ section */

/**
 * Stepped position with end dwells: card 01 holds through the first
 * END_DWELL card-allotments of scroll, 06 through the last, and every card
 * holds mid-pin before a smoothstep transition. Returns the fractional
 * position plus each end-dwell's progress for the drift feedback.
 */
function railPosition(p: number): { u: number; pre: number; post: number } {
  const T = CARD_COUNT - 1;
  const S = T + 2 * END_DWELL;
  const q = Math.min(0.99999, Math.max(0, p)) * S;
  if (q <= END_DWELL) return { u: 0, pre: 1 - q / END_DWELL, post: 0 };
  if (q >= S - END_DWELL)
    return { u: T, pre: 0, post: (q - (S - END_DWELL)) / END_DWELL };
  const x = q - END_DWELL;
  const k = Math.floor(x);
  const f = x - k;
  const HOLD = 0.42;
  if (f < HOLD) return { u: k, pre: 0, post: 0 };
  const g = (f - HOLD) / (1 - HOLD);
  return { u: k + g * g * (3 - 2 * g), pre: 0, post: 0 };
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

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const cards = Array.from(stage.querySelectorAll<HTMLElement>(".sr-card"));
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
    let u = 0;
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
      const pos = railPosition(p);
      const target = scrolling ? pos.u : Math.round(pos.u);
      u += (target - u) * Math.min(1, dt * 11);
      if (Math.abs(target - u) < 0.0008) u = target;

      const isPinned = p > 0.001 && p < 0.999;
      if (isPinned !== wasPinned) {
        wasPinned = isPinned;
        stage.classList.toggle("sr-willchange", isPinned);
      }

      // End-dwell drift: a few px of motion so scroll input never reads as
      // frozen while an edge card holds.
      const drift = (pos.pre - pos.post) * 10;

      cards.forEach((card, i) => {
        const d = i - u;
        const a = Math.min(1, Math.abs(d));
        const x = d * offset + drift;
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
      style={
        pinning
          ? { height: `${100 + (CARD_COUNT - 1 + 2 * END_DWELL) * 65}vh` }
          : undefined
      }
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
              className="max-w-[24ch] text-[clamp(28px,3.2vw,46px)] font-semibold leading-[0.98] tracking-[-0.03em] text-white"
            >
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

        <div
          ref={stageRef}
          className={
            pinning
              ? "relative mt-5 h-[min(70vh,760px)]"
              : reduced
                ? "mx-auto mt-8 grid w-full max-w-7xl gap-5 px-4 sm:px-6"
                : "sr-snap mt-8 flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto px-4 pb-4 sm:px-6"
          }
        >
          {CARDS.map((c, i) => (
            <article
              key={c.eyebrow}
              tabIndex={0}
              className={`sr-card flex flex-col gap-2 ${
                pinning
                  ? "absolute left-1/2 top-1/2 h-full w-[min(84vw,1220px)]"
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
              {/* page-level context, outside the app window */}
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-1">
                <p className="label !text-[11px] !text-white/85">{c.eyebrow}</p>
                <h3 className="text-[clamp(17px,1.5vw,22px)] font-semibold leading-tight tracking-[-0.02em] text-white">
                  {c.title}
                </h3>
                <p className="hidden truncate text-[12.5px] text-white/65 lg:block lg:max-w-[46ch]">
                  {c.body}
                </p>
              </div>
              <AppFrame
                active={c.nav}
                crumb={c.crumb}
                records={c.records}
                hint={c.hint}
                dark={c.dark}
                toolbar={c.toolbar(c.dark)}
              >
                {c.screen(running)}
              </AppFrame>
            </article>
          ))}
        </div>

        {pinning ? (
          <div className="mt-5 flex items-center justify-center gap-4">
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
        .sr-card { outline: none; }
        .sr-card:focus-visible { outline: 2px solid #c9242c; outline-offset: 3px; }
        .sr-card > div + div { transition: box-shadow .2s ease; }
        .sr-card:hover > div + div { box-shadow: 0 18px 50px rgb(23 23 26 / .18); }
        .sr-snap .sr-card { scroll-snap-align: center; flex: 0 0 auto; width: 90vw; }
        .sr-reduced .sr-card { width: auto; min-height: 480px; }
        .sr-row { transition: background-color .15s ease; }
        .sr-row:hover { background-color: rgb(23 23 26 / .04); }

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
