// The navigation model, as data.
//
// One list of destinations, grouped by what a person is trying to do rather
// than by what the database calls it — and re-grouped, not re-populated, when
// a commissioner flips into commissioner mode. Every destination the app has
// appears in both modes; only the order and the section headings change, so
// switching modes can never lose you a page.
//
// Pure data with no imports, so the sidebar (client) and the layouts (server)
// read the same source.

export interface NavItem {
  href: string;
  label: string;
  /** Two-digit rail marker — the mono tick down the left of the sidebar. */
  tag: string;
  /** Match only this exact path (used for the league root). */
  exact?: boolean;
  /** Key into the badge map the shell is handed. */
  badge?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export type Mode = "player" | "commish";

/** Numbers the rail top to bottom, so the tags read 01, 02, 03… in order. */
function numbered(groups: { label: string; items: Omit<NavItem, "tag">[] }[]) {
  let n = 0;
  return groups.map((g) => ({
    label: g.label,
    items: g.items.map((item) => {
      n += 1;
      return { ...item, tag: String(n).padStart(2, "0") };
    }),
  }));
}

/**
 * The league rail. `admin` adds the Console; `mode` decides whether the
 * week's play or the commissioner's queue sits at the top.
 */
export function leagueNav(
  slug: string,
  { admin, mode }: { admin: boolean; mode: Mode },
): NavGroup[] {
  const b = `/league/${slug}`;
  const overview = { href: b, label: "Overview", exact: true };
  const schedule = { href: `${b}/schedule`, label: "Schedule" };
  const availability = {
    href: `${b}/availability`,
    label: "Availability",
    badge: "availability",
  };
  const standings = { href: `${b}/standings`, label: "Standings" };
  const stats = { href: `${b}/stats`, label: "Stat leaders" };
  const playoffs = { href: `${b}/playoffs`, label: "Playoffs" };
  const teams = { href: `${b}/teams`, label: "Teams" };
  const draft = { href: `${b}/draft`, label: "Draft" };
  const trades = { href: `${b}/trades`, label: "Trades", badge: "trades" };
  const members = { href: `${b}/members`, label: "Members" };
  const rules = { href: `${b}/rules`, label: "Rules" };
  const console = { href: `${b}/console`, label: "Console" };
  // Admin-only: RLS hides every recording from players, so the page would be
  // an empty room for them — the destination only exists in admin rails.
  const film = { href: `${b}/film`, label: "Film" };

  if (mode === "commish" && admin) {
    return numbered([
      { label: "Run today", items: [overview, schedule, availability, film] },
      { label: "Roster moves", items: [teams, draft, trades, members] },
      { label: "The season", items: [standings, stats, playoffs] },
      { label: "Setup", items: [console, rules] },
    ]);
  }

  return numbered([
    { label: "This week", items: [overview, schedule, availability] },
    { label: "The season", items: [standings, stats, playoffs] },
    {
      label: "The league",
      items: admin
        ? [teams, draft, trades, members, film, rules, console]
        : [teams, draft, trades, members, rules],
    },
  ]);
}

/** The rail outside a league. */
export function mainNav(): NavGroup[] {
  return numbered([
    {
      label: "You",
      items: [
        { href: "/dashboard", label: "Leagues" },
        { href: "/inbox", label: "Inbox", badge: "inbox" },
        { href: "/profile", label: "Profile" },
      ],
    },
    {
      label: "Add a league",
      items: [
        { href: "/join", label: "Join with a code" },
        { href: "/leagues/new", label: "Start a league" },
      ],
    },
  ]);
}

export function isNavActive(pathname: string, item: NavItem): boolean {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/* ------------------------------ screen meta -------------------------------
   What the page header says. Written once here rather than at thirteen call
   sites, which is what keeps the crumb → title → subtitle rhythm identical
   from tab to tab. */

export interface ScreenMeta {
  crumb: string;
  title: string;
  subtitle: string;
}

export interface ScreenContext {
  slug: string;
  leagueName: string;
  seasonName: string | null;
  mode: Mode;
  admin: boolean;
}

const LEAGUE_SCREENS: Record<string, Omit<ScreenMeta, "crumb"> & { section: string }> = {
  "": {
    section: "This week",
    title: "Overview",
    subtitle: "What's on, what needs you, and where the season stands.",
  },
  schedule: {
    section: "This week",
    title: "Schedule",
    subtitle: "Every game, laid out the way the gym is booked.",
  },
  availability: {
    section: "This week",
    title: "Availability",
    subtitle: "Mark the periods you can play. Captains build lineups from this.",
  },
  standings: {
    section: "The season",
    title: "Standings",
    subtitle: "Record first, then the tiebreakers that separate the ties.",
  },
  stats: {
    section: "The season",
    title: "Stat leaders",
    subtitle: "Season totals and per-game averages for every player.",
  },
  playoffs: {
    section: "The season",
    title: "Playoffs",
    subtitle: "Seeding and the bracket, updated as results land.",
  },
  teams: {
    section: "The league",
    title: "Teams",
    subtitle: "Rosters, captains, and who is still free to be picked up.",
  },
  draft: {
    section: "The league",
    title: "Draft",
    subtitle: "The board, the clock, and the queue behind each pick.",
  },
  trades: {
    section: "The league",
    title: "Trades",
    subtitle: "Propose a swap, respond to one, or read the transaction log.",
  },
  members: {
    section: "The league",
    title: "Members",
    subtitle: "Everyone in the league and what they are allowed to do.",
  },
  rules: {
    section: "The league",
    title: "Rules",
    subtitle: "The house rules, and the documents that back them up.",
  },
  console: {
    section: "Setup",
    title: "Console",
    subtitle: "Seasons, slots, venues, appearance — the league's own settings.",
  },
  film: {
    section: "Run today",
    title: "Film",
    subtitle: "Upload game film, scan it for shots, and review every call into the box score.",
  },
};

/*
  Detail routes name themselves — a team page's own hero carries the badge and
  the record, and repeating "Team" above it would be a header saying less than
  the thing under it. These get the crumb only.
*/
const DETAIL_SECTION: Record<string, string> = {
  team: "The league · Team",
  player: "The league · Player",
  game: "This week · Game",
};

const MAIN_SCREENS: Record<string, ScreenMeta> = {
  "/dashboard": {
    crumb: "You",
    title: "Your leagues",
    subtitle: "Where you play, and what is waiting on you in each one.",
  },
  "/inbox": {
    crumb: "You",
    title: "Inbox",
    subtitle: "Picks, trades, schedule changes and results.",
  },
  "/profile": {
    crumb: "You",
    title: "Profile",
    subtitle: "Your photo, your position, and how the app looks to you.",
  },
  "/join": {
    crumb: "Add a league",
    title: "Join a league",
    subtitle: "Six characters from your commissioner is all it takes.",
  },
  "/leagues/new": {
    crumb: "Add a league",
    title: "Start a league",
    subtitle: "Name it, pick a sport, and invite the school.",
  },
};

/** The segment straight after `/league/<slug>`, or "" for the league root. */
export function leagueSegment(pathname: string, slug: string): string {
  const base = `/league/${slug}`;
  if (!pathname.startsWith(base)) return "";
  return pathname.slice(base.length).replace(/^\//, "").split("/")[0] ?? "";
}

export function leagueScreenMeta(
  pathname: string,
  ctx: ScreenContext,
): ScreenMeta {
  const role = ctx.mode === "commish" && ctx.admin ? "Commissioner" : "Player view";
  const segment = leagueSegment(pathname, ctx.slug);

  // The one game route that is a form rather than a record.
  if (segment === "game" && pathname.endsWith("/game/new")) {
    return {
      crumb: `${role} · This week`,
      title: "New game",
      subtitle: "Any matchup, playable right now — no schedule required.",
    };
  }

  const detail = DETAIL_SECTION[segment];
  if (detail) return { crumb: `${role} · ${detail}`, title: "", subtitle: "" };

  // The review room names itself with the matchup — crumb only, like other
  // detail routes; the film index keeps its full header.
  if (segment === "film" && !pathname.replace(/\/$/, "").endsWith("/film")) {
    return { crumb: `${role} · Run today · Film`, title: "", subtitle: "" };
  }

  const screen = LEAGUE_SCREENS[segment];
  if (!screen) {
    return { crumb: role, title: ctx.leagueName, subtitle: ctx.seasonName ?? "" };
  }
  return {
    crumb: `${role} · ${screen.section}`,
    title: screen.title,
    subtitle: screen.subtitle,
  };
}

export function mainScreenMeta(pathname: string): ScreenMeta {
  for (const [href, meta] of Object.entries(MAIN_SCREENS)) {
    if (pathname === href || pathname.startsWith(`${href}/`)) return meta;
  }
  return { crumb: "You", title: "Intramural", subtitle: "" };
}
