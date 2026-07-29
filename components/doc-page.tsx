import Link from "next/link";
import type { ReactNode } from "react";
import { Lockup, Mark } from "@/components/mark";

/*
  Shell for the standalone reference pages (privacy, support). These are
  linked from the App Store listing, so they are reached cold by people who
  have never seen the app — hence the full lockup and a way back into it,
  rather than the in-app chrome.
*/
export function DocPage({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
      <header className="flex items-center justify-between gap-3 py-6">
        <Link href="/" aria-label="Intramural home">
          <Mark size={34} tone="white-red" className="shrink-0 sm:hidden" />
          <Lockup size={38} tone="white-red" className="hidden sm:inline-flex" />
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center px-2 text-[17px] font-medium text-white hover:text-white/70"
        >
          Home
        </Link>
      </header>

      <div className="card flex flex-col gap-7 p-7 sm:p-9">
        <div>
          <p className="label !text-accent">{eyebrow}</p>
          <h1 className="mt-3 text-[34px] font-semibold leading-[1.1] tracking-[-0.03em]">
            {title}
          </h1>
          <p className="label mt-3 !text-ink-muted">Last updated {updated}</p>
        </div>
        {children}
      </div>

      <footer className="py-12">
        <nav className="flex flex-wrap gap-6 text-[17px] font-medium text-white">
          <Link href="/privacy" className="hover:text-white/70">
            Privacy
          </Link>
          <Link href="/support" className="hover:text-white/70">
            Support
          </Link>
        </nav>
      </footer>
    </div>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.02em]">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function P({ children }: { children: ReactNode }) {
  return (
    <p className="max-w-[68ch] text-[17px] leading-[1.6] text-ink-body">
      {children}
    </p>
  );
}

export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li
          key={i}
          className="max-w-[68ch] border-l-2 border-ink/10 pl-4 text-[17px] leading-[1.6] text-ink-body"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}
