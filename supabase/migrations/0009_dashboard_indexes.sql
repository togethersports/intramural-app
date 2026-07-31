-- Indexes for the queries every signed-in page runs.
--
-- The dashboard's "next game" asks for games where I am on either side:
--
--   where status in ('scheduled','live')
--     and (home_team_id in (...) or away_team_id in (...))
--   order by scheduled_date
--
-- The only index on games was (season_id, week), which that predicate cannot
-- use — so it was a sequential scan of every game in the database, filtered
-- by RLS afterwards. Fine at demo size, linear as leagues accumulate.

create index if not exists games_home_team_idx
  on public.games (home_team_id, scheduled_date);
create index if not exists games_away_team_idx
  on public.games (away_team_id, scheduled_date);

-- "Is a draft live in one of my leagues?" runs on every dashboard load and
-- matches almost nothing almost always — exactly what a partial index is for.
create index if not exists drafts_live_idx
  on public.drafts (season_id) where status = 'live';

-- The last stat line is ordered by created_at and limited to 1; pgs_user_idx
-- (user_id) alone made that a sort of every line the player has ever put up.
create index if not exists pgs_user_recent_idx
  on public.player_game_stats (user_id, created_at desc);
