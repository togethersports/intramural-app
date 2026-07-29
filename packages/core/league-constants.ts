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
