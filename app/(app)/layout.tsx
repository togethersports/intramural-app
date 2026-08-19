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
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return <>{children}</>;
}
