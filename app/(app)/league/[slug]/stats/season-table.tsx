"use client";

/**
 * The whole season, every player, sorted however you want to read it.
 *
 * Two controls, because they answer two different questions. Totals answer
 * "who did the most this season"; per-game answers "who is best", which is
 * the only fair comparison between someone who played nine games and someone
 * who played three. Sorting is a click on the column you care about, and a
 * second click flips it — the same gesture the phone app uses.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { formatPct, pct, perGame, type SeasonTotals } from "@core/stats";

export interface SeasonTableRow {
  userId: string;
  name: string;
  teamName: string;
  teamColor: string;
  totals: SeasonTotals;
}

type Mode = "totals" | "avg";

interface Column {
  key: string;
  label: string;
  /** The number this cell sorts by. */
  value: (r: SeasonTableRow, mode: Mode) => number;
  /** What the cell prints. */
  render: (r: SeasonTableRow, mode: Mode) => string;
  /** Percentages and +/− are the same either way. */
  rateOnly?: boolean;
}

const counted = (
  key: string,
  label: string,
  pick: (t: SeasonTotals) => number,
): Column => ({
  key,
  label,
  value: (r, mode) =>
    mode === "avg" ? perGame(pick(r.totals), r.totals.games) : pick(r.totals),
  render: (r, mode) =>
    mode === "avg"
      ? perGame(pick(r.totals), r.totals.games).toFixed(1)
      : String(pick(r.totals)),
});

const COLUMNS: Column[] = [
  {
    key: "gp",
    label: "GP",
    value: (r) => r.totals.games,
    render: (r) => String(r.totals.games),
    rateOnly: true,
  },
  counted("pts", "PTS", (t) => t.pts),
  counted("reb", "REB", (t) => t.reb),
  counted("ast", "AST", (t) => t.ast),
  counted("stl", "STL", (t) => t.stl),
  counted("blk", "BLK", (t) => t.blk),
  counted("tov", "TO", (t) => t.tov),
  {
    key: "fg",
    label: "FG%",
    value: (r) => pct(r.totals.fgm, r.totals.fga) ?? -1,
    render: (r) => formatPct(pct(r.totals.fgm, r.totals.fga)),
    rateOnly: true,
  },
  {
    key: "tp",
    label: "3P%",
    value: (r) => pct(r.totals.tpm, r.totals.tpa) ?? -1,
    render: (r) => formatPct(pct(r.totals.tpm, r.totals.tpa)),
    rateOnly: true,
  },
  {
    key: "ft",
    label: "FT%",
    value: (r) => pct(r.totals.ftm, r.totals.fta) ?? -1,
    render: (r) => formatPct(pct(r.totals.ftm, r.totals.fta)),
    rateOnly: true,
  },
  {
    key: "pm",
    label: "+/−",
    value: (r) => r.totals.plus_minus,
    render: (r) =>
      r.totals.plus_minus > 0 ? `+${r.totals.plus_minus}` : String(r.totals.plus_minus),
    rateOnly: true,
  },
];

export function SeasonTable({
  slug,
  rows,
}: {
  slug: string;
  rows: SeasonTableRow[];
}) {
  const [mode, setMode] = useState<Mode>("totals");
  const [sortKey, setSortKey] = useState<string>("pts");
  const [descending, setDescending] = useState(true);

  const sorted = useMemo(() => {
    const column = COLUMNS.find((c) => c.key === sortKey);
    const copy = [...rows];
    copy.sort((a, b) => {
      const cmp =
        sortKey === "name"
          ? a.name.localeCompare(b.name)
          : sortKey === "team"
            ? a.teamName.localeCompare(b.teamName) || a.name.localeCompare(b.name)
            : column
              ? column.value(a, mode) - column.value(b, mode) ||
                a.name.localeCompare(b.name)
              : 0;
      return descending ? -cmp : cmp;
    });
    return copy;
  }, [rows, sortKey, descending, mode]);

  const toggle = (key: string) => {
    if (key === sortKey) {
      setDescending((d) => !d);
      return;
    }
    setSortKey(key);
    // Numbers start best-first; names start A-first.
    setDescending(key !== "name" && key !== "team");
  };

  const arrow = descending ? "▾" : "▴";
  const headClass = (key: string) =>
    `cursor-pointer select-none py-1.5 font-medium transition-colors ${
      sortKey === key ? "text-ink" : "text-ink-faint hover:text-ink-body"
    }`;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-5 pt-4 sm:px-6">
        <div
          role="group"
          aria-label="Show"
          className="grid grid-cols-2 gap-1 rounded-full bg-paper p-1"
        >
          {(["totals", "avg"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={
                mode === m
                  ? "min-h-10 rounded-full bg-ink px-4 text-[13px] font-semibold text-on-ink"
                  : "min-h-10 rounded-full px-4 text-[13px] font-semibold text-ink-muted transition-colors hover:text-ink"
              }
            >
              {m === "totals" ? "Totals" : "Per game"}
            </button>
          ))}
        </div>
        <p className="text-sm text-ink-faint">
          Tap a column to sort by it; tap again to flip.
        </p>
      </div>

      <div className="scroll-x px-5 pb-5 sm:px-6 sm:pb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs">
              <th
                scope="col"
                className={`${headClass("name")} pr-2`}
                onClick={() => toggle("name")}
              >
                Player{sortKey === "name" ? ` ${arrow}` : ""}
              </th>
              <th
                scope="col"
                className={`${headClass("team")} pr-2`}
                onClick={() => toggle("team")}
              >
                Team{sortKey === "team" ? ` ${arrow}` : ""}
              </th>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`${headClass(c.key)} tabular px-2 text-right`}
                  onClick={() => toggle(c.key)}
                >
                  {c.label}
                  {sortKey === c.key ? ` ${arrow}` : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.userId} className="border-t border-rule">
                <td className="sticky-cell sticky left-0 z-10 max-w-[9rem] truncate py-2.5 pr-3">
                  <Link
                    href={`/league/${slug}/player/${p.userId}`}
                    className="font-semibold hover:underline"
                  >
                    {p.name}
                  </Link>
                </td>
                <td className="py-2.5 pr-2">
                  <span className="flex max-w-[7rem] items-center gap-1.5 truncate text-xs font-medium text-ink-body">
                    <span
                      aria-hidden
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: p.teamColor }}
                    />
                    {p.teamName}
                  </span>
                </td>
                {COLUMNS.map((c) => (
                  <td
                    key={c.key}
                    className={`tabular px-2 py-2.5 text-right ${
                      sortKey === c.key ? "font-semibold text-ink" : ""
                    }`}
                  >
                    {c.render(p, mode)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
