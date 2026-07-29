import Link from "next/link";
import type { TeamStanding } from "@core/standings";

export interface StandingsDisplayRow extends TeamStanding {
  name: string;
  abbrev: string;
  color: string;
}

export function StandingsTable({
  rows,
  slug,
  full = false,
}: {
  rows: StandingsDisplayRow[];
  slug: string;
  full?: boolean;
}) {
  return (
    <div className="scroll-x">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="label sticky left-0 z-10 bg-surface py-2 pr-3">Team</th>
            <th className="tabular px-2 py-2 text-right font-medium">W</th>
            <th className="tabular px-2 py-2 text-right font-medium">L</th>
            {full ? (
              <>
                <th className="tabular px-2 py-2 text-right font-medium">T</th>
              </>
            ) : null}
            <th className="tabular px-2 py-2 text-right font-medium">PCT</th>
            {full ? (
              <>
                <th className="tabular px-2 py-2 text-right font-medium">GB</th>
                <th className="tabular px-2 py-2 text-right font-medium">PF</th>
                <th className="tabular px-2 py-2 text-right font-medium">PA</th>
                <th className="tabular px-2 py-2 text-right font-medium">DIFF</th>
                <th className="px-2 py-2 text-right font-medium">STRK</th>
                <th className="px-2 py-2 text-right font-medium">L5</th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.teamId} className="border-t border-rule">
              <td className="sticky left-0 z-10 bg-surface py-2.5 pr-3">
                <Link
                  href={`/league/${slug}/team/${r.teamId}`}
                  className="flex items-center gap-2 font-semibold hover:underline"
                >
                  <span className="num w-4 text-right text-[13px] text-ink-faint">
                    {i + 1}
                  </span>
                  <span
                    aria-hidden
                    className="size-3 rounded-full"
                    style={{ backgroundColor: r.color }}
                  />
                  <span className="truncate">{r.name}</span>
                </Link>
              </td>
              <td className="num px-2 py-2.5 text-right text-[15px]">{r.w}</td>
              <td className="num px-2 py-2.5 text-right text-[15px]">{r.l}</td>
              {full ? <td className="num px-2 py-2.5 text-right text-[15px]">{r.t}</td> : null}
              <td className="num px-2 py-2.5 text-right text-[15px]">
                {r.pct.toFixed(3).replace(/^0/, "")}
              </td>
              {full ? (
                <>
                  <td className="num px-2 py-2.5 text-right text-[15px]">
                    {r.gb === 0 ? "—" : r.gb}
                  </td>
                  <td className="num px-2 py-2.5 text-right text-[15px]">{r.pf}</td>
                  <td className="num px-2 py-2.5 text-right text-[15px]">{r.pa}</td>
                  <td
                    className={`tabular px-2 py-2.5 text-right ${
                      r.diff < 0 ? "text-accent" : "text-ink"
                    }`}
                  >
                    {r.diff > 0 ? `+${r.diff}` : r.diff}
                  </td>
                  <td className="px-2 py-2.5 text-right">{r.streak}</td>
                  <td className="px-2 py-2.5 text-right">{r.last5}</td>
                </>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
