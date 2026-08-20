/** Tab-to-tab clicks inside a league keep the header and nav rail on
    screen and swap only the content area to this skeleton, so switching
    tabs responds the instant it's tapped. */
export default function LeagueLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="card h-56 animate-pulse" />
          <div className="card h-72 animate-pulse" />
        </div>
        <div className="space-y-5">
          <div className="card h-48 animate-pulse" />
          <div className="card h-40 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
