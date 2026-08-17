/** Instant response for every navigation inside the app shell: the click
    swaps to this skeleton immediately while the server renders the real
    page. Flat cream blocks on the Court Blue ground, per the brand — no
    spinners, no text that could flash wrong. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      <div className="h-10 w-64 max-w-full animate-pulse rounded-full bg-white/25" />
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="card h-44 animate-pulse" />
        <div className="card h-44 animate-pulse" />
      </div>
      <div className="card h-72 animate-pulse" />
    </div>
  );
}
