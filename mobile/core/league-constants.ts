// Pure constants/types — safe to import from client components.

export type LeagueRole =
  | "commissioner"
  | "admin"
  | "captain"
  | "player"
  | "spectator";

export const SPORTS = [
  { value: "basketball", label: "Basketball" },
  { value: "soccer", label: "Soccer" },
  { value: "volleyball", label: "Volleyball" },
  { value: "flag_football", label: "Flag football" },
  { value: "dodgeball", label: "Dodgeball" },
] as const;

export const LEAGUE_COLORS = [
  "#c8232c",
  "#54749b",
  "#6d8c5e",
  "#dfa04f",
  "#3f5a7c",
  "#191c1f",
] as const;

export function sportLabel(value: string) {
  return SPORTS.find((s) => s.value === value)?.label ?? value;
}

export function isLeagueAdmin(role: LeagueRole) {
  return role === "commissioner" || role === "admin";
}

/*
  Positions people can claim, per sport. A player picks theirs on their
  profile; a captain can override it for their own roster (a natural centre
  who plays the four on this team). Free text is never accepted — the list is
  what makes "all the guards" a query rather than a guess.
*/
export const POSITIONS: Record<string, { value: string; label: string }[]> = {
  basketball: [
    { value: "PG", label: "Point guard" },
    { value: "SG", label: "Shooting guard" },
    { value: "SF", label: "Small forward" },
    { value: "PF", label: "Power forward" },
    { value: "C", label: "Center" },
  ],
  soccer: [
    { value: "GK", label: "Goalkeeper" },
    { value: "DF", label: "Defender" },
    { value: "MF", label: "Midfielder" },
    { value: "FW", label: "Forward" },
  ],
  volleyball: [
    { value: "S", label: "Setter" },
    { value: "OH", label: "Outside hitter" },
    { value: "MB", label: "Middle blocker" },
    { value: "OP", label: "Opposite" },
    { value: "L", label: "Libero" },
  ],
  flag_football: [
    { value: "QB", label: "Quarterback" },
    { value: "WR", label: "Receiver" },
    { value: "RB", label: "Rusher" },
    { value: "DB", label: "Defensive back" },
    { value: "RU", label: "Rusher (D)" },
  ],
  dodgeball: [
    { value: "TH", label: "Thrower" },
    { value: "CA", label: "Catcher" },
    { value: "DO", label: "Dodger" },
  ],
};

export function positionsFor(sport: string) {
  return POSITIONS[sport] ?? POSITIONS.basketball;
}

export function positionLabel(sport: string, value: string) {
  return positionsFor(sport).find((p) => p.value === value)?.label ?? value;
}

/** Whether a stored position string is one this sport actually offers. */
export function isValidPosition(sport: string, value: string) {
  return positionsFor(sport).some((p) => p.value === value);
}
