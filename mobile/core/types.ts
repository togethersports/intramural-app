// Domain row shapes shared across pages and the data layer.

export interface SeasonRow {
  id: string;
  league_id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  num_weeks: number;
  status: "setup" | "draft" | "active" | "playoffs" | "complete";
  playoff_format: { type?: string };
  rules: {
    roster_min?: number;
    roster_max?: number;
    min_players_per_slot?: number;
    max_games_per_team_per_week?: number;
    matchups_per_pair?: number;
    periods?: number;
    period_minutes?: number;
    foul_limit?: number;
    bonus_threshold?: number;
    timeouts_per_team?: number;
    overtime_minutes?: number;
  };
}

export interface TimeSlotRow {
  id: string;
  label: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  kind: "lunch" | "free" | "after_school";
}

export interface VenueRow {
  id: string;
  name: string;
  splittable: boolean;
}

export interface TeamRow {
  id: string;
  season_id: string;
  name: string;
  abbrev: string;
  color: string;
  captain_id: string | null;
  /** Free-text opponent from an ad-hoc game — kept out of standings,
      draft order, and the scheduler. */
  is_external: boolean;
}

export interface RosterEntry {
  id: string; // team_members id, or game_guests id for a guest
  user_id: string; // opaque player key: auth user id, or a guest id
  full_name: string;
  jersey_number: number | null;
  is_captain: boolean;
  /** Free-text player added for one game (game_guests row). */
  is_guest?: boolean;
}

export interface TeamWithRoster extends TeamRow {
  roster: RosterEntry[];
}

export interface DraftRow {
  id: string;
  season_id: string;
  format: "snake" | "linear";
  pick_seconds: number;
  status: "setup" | "live" | "paused" | "complete";
  current_pick_no: number;
  rounds: number;
  pick_order: string[];
  last_pick_at: string | null;
}

export interface DraftPickRow {
  pick_no: number;
  round: number;
  team_id: string;
  user_id: string;
  auto_picked: boolean;
  full_name: string;
}

export interface AvailabilityRow {
  user_id: string;
  time_slot_id: string;
  status: "yes" | "maybe" | "no";
}

export interface GameRow {
  id: string;
  season_id: string;
  week: number;
  home_team_id: string;
  away_team_id: string;
  venue_id: string | null;
  time_slot_id: string | null;
  scheduled_date: string | null;
  status: "scheduled" | "live" | "final" | "forfeit" | "postponed" | "abandoned";
  home_score: number;
  away_score: number;
  period: number;
  clock_ms: number | null;
  scorekeeper_id: string | null;
  is_playoff: boolean;
  is_adhoc: boolean;
  counts_for_standings: boolean;
  /** Per-game overrides merged over the season's rules jsonb. */
  rules_override: Record<string, unknown>;
  bracket_node_id: string | null;
  home_team?: { name: string; abbrev: string; color: string };
  away_team?: { name: string; abbrev: string; color: string };
  time_slot?: { label: string } | null;
  venue?: { name: string } | null;
}

export interface GameEventRow {
  id: string;
  seq: number;
  period: number;
  clock_ms: number | null;
  /** Merged player key by the data layer: auth user id or guest id. */
  user_id: string | null;
  team_id: string | null;
  type: string;
  value: number | null;
  related_user_id: string | null;
  voided: boolean;
  client_uuid: string;
  guest_id: string | null;
}

export interface GameGuestRow {
  id: string;
  game_id: string;
  team_id: string | null;
  display_name: string;
}

export interface LineupRow {
  seq: number;
  team_id: string;
  on_court: string[];
}

export interface PlayerGameStatRow {
  game_id: string;
  user_id: string | null; // null for guest lines — guest_id holds the key
  guest_id?: string | null;
  team_id: string;
  pts: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  plus_minus: number;
  full_name?: string;
}

export interface TradeRow {
  id: string;
  season_id: string;
  from_team_id: string;
  to_team_id: string;
  status: "proposed" | "accepted" | "declined" | "cancelled" | "executed" | "vetoed";
  proposed_by: string;
  note: string;
  created_at: string;
  items: { user_id: string; from_team_id: string; to_team_id: string; full_name: string }[];
}

export interface PostRow {
  id: string;
  kind: "announcement" | "auto" | "team";
  body: string;
  created_at: string;
  author_name: string | null;
  team_id: string | null;
}

export interface NotificationRow {
  id: string;
  category: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface BracketNodeRow {
  id: string;
  round: number;
  position: number;
  home_source: string;
  away_source: string;
  game_id: string | null;
  winner_team_id: string | null;
}
