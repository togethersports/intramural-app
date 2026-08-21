import { ThemeStyle } from "@/components/theme-style";
import { DEFAULT_APPEARANCE } from "@core/theme";

/** Instant response for every navigation inside the app shell: the click
    swaps to this skeleton immediately while the server renders the real
    page. No spinners, no text that could flash wrong.

    It carries the default palette because nothing else can at this point.
    The real one is emitted by `(main)` or `league/[slug]`, and this skeleton
    is precisely what fills the seconds those layouts spend querying for it —
    without this, the wait renders on `@theme`'s Sideline cream, so every
    cold load flashed pale blue before settling onto the dark Court ground.
    Someone who has chosen a non-default palette still sees Court for that
    moment; knowing better before the query answers would mean not needing
    the query. */
export default function Loading() {
  return (
    <>
      <ThemeStyle appearance={DEFAULT_APPEARANCE} />
      <div className="space-y-5" aria-busy="true" aria-label="Loading">
        <div className="h-10 w-64 max-w-full animate-pulse rounded-full bg-surface" />
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="card h-44 animate-pulse" />
          <div className="card h-44 animate-pulse" />
        </div>
        <div className="card h-72 animate-pulse" />
      </div>
    </>
  );
}
