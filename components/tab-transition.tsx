"use client";

import { usePathname } from "next/navigation";

/**
 * Replays the content fade on every tab change.
 *
 * A layout persists across its child routes, so an animation class sitting
 * on a wrapper in the layout only ever runs once — on first arrival in the
 * league. Keying the wrapper on the pathname remounts it per tab, which is
 * what makes each tab settle in rather than snap.
 */
export function TabTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="tab-in">
      {children}
    </div>
  );
}
