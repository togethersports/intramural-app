import type { Viewport } from "next";
import { requireUser } from "@/lib/auth";
import { buildPalette, DEFAULT_APPEARANCE } from "@core/theme";

/** Browser chrome follows the app's ground, not the marketing site's. */
export const viewport: Viewport = {
  themeColor: buildPalette(DEFAULT_APPEARANCE).themeColor,
};

/**
 * Signed-in gate only. The chrome lives one level down — `(main)` draws the
 * personal rail and `league/[slug]` draws the league's — because each one
 * resolves a different appearance, and a theme has to be emitted once by the
 * surface that knows which one is in force.
 *
 * The gate is awaited here rather than inside a streaming child on purpose:
 * a signed-out visitor gets a redirect before any HTML, instead of a flash of
 * app chrome they are not entitled to. `loading.tsx` carries the default
 * palette for the gap this leaves.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return <>{children}</>;
}
