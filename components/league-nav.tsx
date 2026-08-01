"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function LeagueNav({ slug, admin }: { slug: string; admin: boolean }) {
  const pathname = usePathname();
  const railRef = useRef<HTMLElement>(null);
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
    ...(admin
      ? [
          { href: `${base}/console`, label: "Console" },
          // one click from anywhere in the league to a courtside game
          { href: `${base}/game/new`, label: "New game" },
        ]
      : []),
  ];

  // 12 tabs overflow ~4x the viewport on a phone; deep-linking to a later tab
  // would otherwise render a rail that looks static and hides the current page.
  useEffect(() => {
    const active = railRef.current?.querySelector('[aria-current="page"]');
    active?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  return (
    <nav
      ref={railRef}
      aria-label="League"
      className="scroll-x flex gap-1 rounded-full bg-surface p-1.5"
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
