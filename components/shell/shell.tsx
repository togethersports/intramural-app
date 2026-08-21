"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { signOut } from "@/app/(auth)/actions";
import {
  IconBell,
  IconClose,
  IconGrid,
  IconLogout,
  IconMenu,
} from "@/components/icons";
import { Mark } from "@/components/mark";
import { NavIcon } from "@/components/nav-icon";
import { Avatar } from "@/components/ui";
import {
  isNavActive,
  leagueScreenMeta,
  mainScreenMeta,
  type Mode,
  type NavGroup,
  type ScreenContext,
} from "@/lib/nav";

export interface ShellIdentity {
  href: string;
  /** League name, or the product name outside a league. */
  name: string;
  /** Mono line above it — sport · season, or the school. */
  eyebrow: string;
  logoUrl: string | null;
  color: string;
  /** The product tile wears the Bracket mark; a league without a logo wears
      its initial on its own colour, the way TeamBadge does. */
  mark?: boolean;
}

export interface ShellUser {
  name: string;
  avatarUrl: string | null;
  roleLine: string;
}

export interface ShellProps {
  identity: ShellIdentity;
  /** Both rails, pre-built; the toggle picks between them without a fetch. */
  nav: { player: NavGroup[]; commish: NavGroup[] | null };
  badges?: Record<string, number>;
  user: ShellUser;
  initialMode: Mode;
  /** League screens resolve their header from the path; main screens don't. */
  screen: { kind: "league"; ctx: Omit<ScreenContext, "mode"> } | { kind: "main" };
  /** Rendered to the right of the title — the one primary action, if any. */
  action?: React.ReactNode;
  /** Above everything: the demo-league strip, when there is one. */
  banner?: React.ReactNode;
  children: React.ReactNode;
}

/** Read server-side to seed `initialMode`; written client-side on toggle. */
export const MODE_COOKIE = "im_mode";

export function Shell({
  identity,
  nav,
  badges = {},
  user,
  initialMode,
  screen,
  action,
  banner,
  children,
}: ShellProps) {
  const pathname = usePathname();
  const canSwitch = nav.commish !== null;
  // Seeded from the cookie the server read, so the rail renders in the right
  // mode on the very first paint instead of reordering after hydration.
  const [mode, setMode] = useState<Mode>(canSwitch ? initialMode : "player");
  const [drawer, setDrawer] = useState(false);

  // Escape closes the drawer — a full-screen overlay with no keyboard exit is
  // a trap for anyone not using a touchscreen.
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  const switchMode = useCallback((next: Mode) => {
    setMode(next);
    // Remembered so the next server render seeds the same rail.
    document.cookie = `${MODE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  const groups = mode === "commish" && nav.commish ? nav.commish : nav.player;
  const meta =
    screen.kind === "league"
      ? leagueScreenMeta(pathname, { ...screen.ctx, mode })
      : mainScreenMeta(pathname);

  const rail = (
    <>
      <Link
        href={identity.href}
        className="flex items-center gap-2.5 px-1 pb-3.5"
        onClick={() => setDrawer(false)}
      >
        {identity.logoUrl ? (
          // Supabase public bucket; next/image would need the project ref
          // pinned into next.config for a 38px thumbnail.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={identity.logoUrl}
            alt=""
            className="size-[38px] shrink-0 rounded-[12px] object-cover"
          />
        ) : identity.mark ? (
          // The mark is the logo — it does not need a tile around it, and it
          // reads better at the size the tile used to occupy.
          <Mark size={34} tone="theme" className="shrink-0" />
        ) : (
          <span
            aria-hidden
            className="grid size-[38px] shrink-0 place-items-center rounded-[12px] text-[15px] font-semibold text-white"
            style={{ backgroundColor: identity.color }}
          >
            {identity.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">
            {identity.name}
          </span>
          {identity.eyebrow ? (
            <span className="label block truncate !text-[10px]">
              {identity.eyebrow}
            </span>
          ) : null}
        </span>
      </Link>

      {canSwitch ? (
        <div
          role="group"
          aria-label="View as"
          className="grid grid-cols-2 gap-1 rounded-[14px] bg-paper p-1"
        >
          {(["player", "commish"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              aria-pressed={mode === m}
              className={
                mode === m
                  ? m === "commish"
                    ? "min-h-10 rounded-[10px] bg-accent text-[13px] font-semibold text-on-accent"
                    : "min-h-10 rounded-[10px] bg-ink text-[13px] font-semibold text-on-ink"
                  : "min-h-10 rounded-[10px] text-[13px] font-semibold text-ink-muted transition-colors hover:text-ink"
              }
            >
              {m === "player" ? "Player" : "Commish"}
            </button>
          ))}
        </div>
      ) : null}

      <nav
        aria-label="Sections"
        className="scroll-contain -mx-1 mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1"
      >
        {groups.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            <p className="label px-2 pb-1.5 !text-[10px] !tracking-[0.18em]">
              {group.label}
            </p>
            {group.items.map((item) => {
              const active = isNavActive(pathname, item);
              const count = item.badge ? (badges[item.badge] ?? 0) : 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setDrawer(false)}
                  className={
                    active
                      ? "flex min-h-11 items-center gap-2.5 rounded-[11px] bg-paper px-2.5 text-[15px] font-semibold text-ink"
                      : "flex min-h-11 items-center gap-2.5 rounded-[11px] px-2.5 text-[15px] font-medium text-ink-muted transition-colors hover:bg-paper hover:text-ink"
                  }
                >
                  <span
                    className={
                      active ? "shrink-0 text-ink" : "shrink-0 text-ink-faint"
                    }
                  >
                    <NavIcon name={item.icon} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {count > 0 ? (
                    <span className="num grid min-w-5 shrink-0 place-items-center rounded-full bg-accent px-1.5 text-[10px] text-on-accent">
                      {count > 9 ? "9+" : count}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* The two destinations that exist outside whatever rail is showing, so
          a league never becomes a room with no door. */}
      <div className="mt-3 flex items-center gap-1 border-t border-rule pt-3">
        {[
          { href: "/dashboard", label: "Leagues", icon: <IconGrid size={17} /> },
          {
            href: "/inbox",
            label: "Inbox",
            icon: <IconBell size={17} />,
            count: badges.inbox ?? 0,
          },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setDrawer(false)}
            className={
              pathname === link.href
                ? "flex min-h-10 flex-1 items-center gap-2 rounded-[11px] bg-paper px-2.5 text-[13px] font-semibold text-ink"
                : "flex min-h-10 flex-1 items-center gap-2 rounded-[11px] px-2.5 text-[13px] font-medium text-ink-muted transition-colors hover:bg-paper hover:text-ink"
            }
          >
            {link.icon}
            <span className="truncate">{link.label}</span>
            {link.count ? (
              <span className="num ml-auto grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] text-on-accent">
                {link.count > 9 ? "9+" : link.count}
              </span>
            ) : null}
          </Link>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2 rounded-[14px] bg-paper p-2">
        <Link
          href="/profile"
          className="flex min-w-0 flex-1 items-center gap-2.5"
          onClick={() => setDrawer(false)}
        >
          <Avatar name={user.name} src={user.avatarUrl} size={32} />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold">
              {user.name}
            </span>
            <span className="block truncate text-[11px] text-ink-faint">
              {user.roleLine}
            </span>
          </span>
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            aria-label="Sign out"
            title="Sign out"
            className="grid size-9 place-items-center rounded-full text-ink-faint transition-colors hover:bg-surface hover:text-ink"
          >
            <IconLogout size={18} />
          </button>
        </form>
      </div>
    </>
  );

  return (
    <div className="mx-auto flex w-full max-w-[88rem] flex-1 items-start gap-5 px-4 py-5 px-safe sm:px-6">
      {/* Desktop rail */}
      <aside className="card sticky top-5 hidden h-[calc(100dvh-2.5rem)] w-[248px] shrink-0 flex-col p-3.5 lg:flex">
        {rail}
      </aside>

      {/* Phone drawer */}
      {drawer ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawer(false)}
            className="absolute inset-0 bg-black/45"
          />
          <aside className="card-solid absolute inset-y-0 left-0 flex w-[19rem] max-w-[86vw] flex-col p-3.5 pt-safe">
            <button
              type="button"
              onClick={() => setDrawer(false)}
              aria-label="Close menu"
              className="absolute right-3 top-3 grid size-10 place-items-center rounded-full text-ink-faint hover:text-ink"
            >
              <IconClose size={20} />
            </button>
            {rail}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {banner}

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawer(true)}
              aria-label="Open menu"
              aria-expanded={drawer}
              className="card grid size-11 shrink-0 place-items-center text-ink lg:hidden"
            >
              <IconMenu size={20} />
            </button>
            <div className="min-w-0">
              {/* The crumb ("You", "Commissioner · Run today") came out: the
                  sidebar already shows where you are, so it was a header
                  repeating the navigation in grey. */}
              {/* Detail routes leave the title empty: their own hero names
                  the team or the player better than a generic word would. */}
              {meta.title ? (
                <h1 className="mt-1 truncate text-[clamp(22px,2.6vw,28px)] font-semibold leading-[1.15] tracking-[-0.025em]">
                  {meta.title}
                </h1>
              ) : null}
              {meta.subtitle ? (
                <p className="mt-1 max-w-[46rem] text-[14.5px] text-ink-body">
                  {meta.subtitle}
                </p>
              ) : null}
            </div>
          </div>
          {action ? <div className="flex items-center gap-2">{action}</div> : null}
        </div>

        <main className="flex-1 pb-6">{children}</main>
      </div>
    </div>
  );
}
