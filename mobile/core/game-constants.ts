// Event vocabulary shared by the tracker UI, stats engine, and play-by-play.
// Pure constants — safe for client components.

export const PLAYER_EVENTS = [
  { type: "fg2_made", label: "2PT ✓", points: 2 },
  { type: "fg3_made", label: "3PT ✓", points: 3 },
  { type: "ft_made", label: "FT ✓", points: 1 },
  { type: "fg2_miss", label: "2PT ✗", points: 0 },
  { type: "fg3_miss", label: "3PT ✗", points: 0 },
  { type: "ft_miss", label: "FT ✗", points: 0 },
  { type: "oreb", label: "OREB", points: 0 },
  { type: "dreb", label: "DREB", points: 0 },
  { type: "ast", label: "AST", points: 0 },
  { type: "stl", label: "STL", points: 0 },
  { type: "blk", label: "BLK", points: 0 },
  { type: "to", label: "TO", points: 0 },
  { type: "pf", label: "FOUL", points: 0 },
  { type: "tf", label: "TECH", points: 0 },
] as const;

export type PlayerEventType = (typeof PLAYER_EVENTS)[number]["type"];

export const EVENT_LABELS: Record<string, string> = {
  fg2_made: "made a 2-pointer",
  fg2_miss: "missed a 2-pointer",
  fg3_made: "made a 3-pointer",
  fg3_miss: "missed a 3-pointer",
  ft_made: "made a free throw",
  ft_miss: "missed a free throw",
  oreb: "offensive rebound",
  dreb: "defensive rebound",
  ast: "assist",
  stl: "steal",
  blk: "block",
  to: "turnover",
  pf: "personal foul",
  tf: "technical foul",
  sub: "substitution",
  timeout: "timeout",
  period_start: "period started",
  period_end: "period ended",
  jump_ball: "jump ball",
};

export const SCORING_POINTS: Record<string, number> = {
  fg2_made: 2,
  fg3_made: 3,
  ft_made: 1,
};
