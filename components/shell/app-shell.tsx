"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";
import {
  IconBall,
  IconBell,
  IconGrid,
  IconLogout,
  IconPlus,
  IconTicket,
} from "@/components/icons";
import { Avatar } from "@/components/ui";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: IconGrid },
  { href: "/join", label: "Join a league", icon: IconTicket },
  { href: "/leagues/new", label: "Start a league", icon: IconPlus },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  name,
  unread = 0,
  children,
}: {
  name: string;
  unread?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 gap-5 px-4 py-5 sm:px-6">
      {/* Desktop icon rail */}
      <aside className="sticky top-5 hidden h-[calc(100dvh-2.5rem)] w-[4.5rem] shrink-0 flex-col items-center rounded-card bg-surface py-4 shadow-card md:flex">
        <Link
          href="/dashboard"
          aria-label="Intramural home"
          className="grid size-11 place-items-center rounded-[14px] bg-ink text-surface"
        >
          <IconBall size={24} />
        </Link>
        <nav className="mt-6 flex flex-col gap-2" aria-label="Main">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                title={label}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "grid size-11 place-items-center rounded-control bg-ink text-surface"
                    : "grid size-11 place-items-center rounded-control text-ink-faint transition-colors hover:bg-surface-dim hover:text-ink"
                }
              >
                <Icon size={21} />
              </Link>
            );
          })}
        </nav>
        <form action={signOut} className="mt-auto">
          <button
            type="submit"
            aria-label="Sign out"
            title="Sign out"
            className="grid size-11 place-items-center rounded-control text-ink-faint transition-colors hover:bg-surface-dim hover:text-ink"
          >
            <IconLogout size={21} />
          </button>
        </form>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-5">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="grid size-11 place-items-center rounded-[14px] bg-surface text-ink shadow-card md:hidden"
            aria-label="Intramural home"
          >
            <IconBall size={24} />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/inbox"
              aria-label={`Inbox${unread > 0 ? `, ${unread} unread` : ""}`}
              className={`relative grid size-11 place-items-center rounded-full shadow-card ${
                pathname === "/inbox"
                  ? "bg-ink text-surface"
                  : "bg-surface text-ink-soft hover:text-ink"
              }`}
            >
              <IconBell size={20} />
              {unread > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Link>
            <div className="flex items-center gap-2 rounded-full bg-surface py-1.5 pl-1.5 pr-4 shadow-card">
              <Avatar name={name} size={34} />
              <span className="max-w-40 truncate text-sm font-semibold">
                {name}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 pb-24 md:pb-4">{children}</main>
      </div>

      {/* Mobile bottom tabs */}
      <nav
        aria-label="Main"
        className="fixed inset-x-4 bottom-4 z-40 flex items-stretch justify-around rounded-full bg-ink/95 px-2 py-1.5 shadow-float backdrop-blur md:hidden"
      >
        {nav.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-full bg-surface text-ink"
                  : "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-surface/70"
              }
            >
              <Icon size={20} />
              <span className="text-[10px] font-semibold">{label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
