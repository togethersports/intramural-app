"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function LeagueNav({ slug, admin }: { slug: string; admin: boolean }) {
  const pathname = usePathname();
  const base = `/league/${slug}`;
  const items = [
    { href: base, label: "Overview", exact: true },
    { href: `${base}/schedule`, label: "Schedule" },
    { href: `${base}/standings`, label: "Standings" },
    { href: `${base}/stats`, label: "Stats" },
    { href: `${base}/teams`, label: "Teams" },
    { href: `${base}/availability`, label: "Availability" },
    { href: `${base}/draft`, label: "Draft" },
    { href: `${base}/trades`, label: "Trades" },
    { href: `${base}/playoffs`, label: "Playoffs" },
    { href: `${base}/rules`, label: "Rules" },
    { href: `${base}/members`, label: "Members" },
    ...(admin ? [{ href: `${base}/console`, label: "Console" }] : []),
  ];

  return (
    <nav
      aria-label="League"
      className="flex gap-1 overflow-x-auto rounded-full bg-surface p-1.5 [scrollbar-width:none]"
    >
      {items.map(({ href, label, exact }) => {
        const active = exact
          ? pathname === href
          : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "min-h-11 shrink-0 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-surface"
                : "min-h-11 shrink-0 rounded-full px-4 py-2.5 text-[15px] font-medium text-ink-body transition-colors hover:bg-rule hover:text-ink"
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
