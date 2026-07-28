-- Availability grids, games, the live event stream, lineups, and
-- materialized per-game stat lines.

create table public.availability (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  season_id uuid not null references public.seasons (id) on delete cascade,
  time_slot_id uuid not null references public.time_slots (id) on delete cascade,
  status text not null check (status in ('yes', 'maybe', 'no')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, season_id, time_slot_id)
);
create index availability_season_idx on public.availability (season_id, time_slot_id);

create table public.availability_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  season_id uuid not null references public.seasons (id) on delete cascade,
  date date not null,
  time_slot_id uuid references public.time_slots (id) on delete cascade,
  status text not null check (status in ('yes', 'maybe', 'no')),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  week smallint not null default 1,
  home_team_id uuid not null references public.teams (id) on delete cascade,
  away_team_id uuid not null references public.teams (id) on delete cascade,
  venue_id uuid references public.venues (id) on delete set null,
  time_slot_id uuid references public.time_slots (id) on delete set null,
  scheduled_date date,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'live', 'final', 'forfeit', 'postponed')),
  home_score smallint not null default 0,
  away_score smallint not null default 0,
  period smallint not null default 0,
  clock_ms int,
  scorekeeper_id uuid references auth.users (id) on delete set null,
  is_playoff boolean not null default false,
  bracket_node_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (home_team_id <> away_team_id)
);
create index games_season_idx on public.games (season_id, week);
create index games_slot_idx on public.games (scheduled_date, time_slot_id, venue_id);

create table public.game_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  seq int not null,
  period smallint not null default 1,
  clock_ms int,
  team_id uuid references public.teams (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  type text not null check (type in (
    'fg2_made', 'fg2_miss', 'fg3_made', 'fg3_miss', 'ft_made', 'ft_miss',
    'oreb', 'dreb', 'ast', 'stl', 'blk', 'to', 'pf', 'tf',
    'sub', 'timeout', 'period_start', 'period_end', 'jump_ball'
  )),
  value smallint,
  related_user_id uuid references auth.users (id) on delete set null,
  created_by uuid not null references auth.users (id) on delete cascade,
  client_uuid uuid not null,
  voided boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, client_uuid) -- idempotent offline sync
);
create index game_events_game_idx on public.game_events (game_id, seq);

create table public.lineup_states (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  seq int not null default 0,
  team_id uuid not null references public.teams (id) on delete cascade,
  on_court uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lineup_states_game_idx on public.lineup_states (game_id, team_id, seq);

create table public.player_game_stats (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  pts smallint not null default 0,
  fgm smallint not null default 0,
  fga smallint not null default 0,
  tpm smallint not null default 0,
  tpa smallint not null default 0,
  ftm smallint not null default 0,
  fta smallint not null default 0,
  oreb smallint not null default 0,
  dreb smallint not null default 0,
  reb smallint not null default 0,
  ast smallint not null default 0,
  stl smallint not null default 0,
  blk smallint not null default 0,
  tov smallint not null default 0,
  pf smallint not null default 0,
  plus_minus smallint not null default 0,
  minutes numeric(5, 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, user_id)
);
create index pgs_user_idx on public.player_game_stats (user_id);
create index pgs_game_idx on public.player_game_stats (game_id);

create trigger availability_updated_at before update on public.availability
  for each row execute function public.set_updated_at();
create trigger availability_overrides_updated_at before update on public.availability_overrides
  for each row execute function public.set_updated_at();
create trigger games_updated_at before update on public.games
  for each row execute function public.set_updated_at();
create trigger game_events_updated_at before update on public.game_events
  for each row execute function public.set_updated_at();
create trigger lineup_states_updated_at before update on public.lineup_states
  for each row execute function public.set_updated_at();
create trigger player_game_stats_updated_at before update on public.player_game_stats
  for each row execute function public.set_updated_at();

create or replace function public.league_of_game(p_game uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select public.league_of_season(season_id) from public.games where id = p_game
$$;

create or replace function public.can_score_game(p_game uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.games g
    where g.id = p_game
      and (g.scorekeeper_id = auth.uid()
           or public.is_league_admin(public.league_of_game(p_game)))
  )
$$;

-- ----------------------------------------------------------------------- RLS

alter table public.availability enable row level security;
alter table public.availability_overrides enable row level security;
alter table public.games enable row level security;
alter table public.game_events enable row level security;
alter table public.lineup_states enable row level security;
alter table public.player_game_stats enable row level security;

-- Availability is visible league-wide (heatmaps); writable by its owner.
create policy "availability: members read" on public.availability for select to authenticated
  using (public.league_role(public.league_of_season(season_id)) is not null);
create policy "availability: own write" on public.availability for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "overrides: members read" on public.availability_overrides for select to authenticated
  using (public.league_role(public.league_of_season(season_id)) is not null);
create policy "overrides: own write" on public.availability_overrides for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "games: members read" on public.games for select to authenticated
  using (public.league_role(public.league_of_season(season_id)) is not null);
create policy "games: admins write" on public.games for all to authenticated
  using (public.is_league_admin(public.league_of_season(season_id)))
  with check (public.is_league_admin(public.league_of_season(season_id)));
-- the assigned scorekeeper can run the game (status/clock/score fields)
create policy "games: scorekeeper updates" on public.games for update to authenticated
  using (scorekeeper_id = auth.uid())
  with check (scorekeeper_id = auth.uid());

create policy "events: members read" on public.game_events for select to authenticated
  using (public.league_role(public.league_of_game(game_id)) is not null);
create policy "events: scorekeeper writes" on public.game_events for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.can_score_game(game_id)
    and exists (select 1 from public.games g where g.id = game_id and g.status = 'live')
  );
create policy "events: scorekeeper voids" on public.game_events for update to authenticated
  using (public.can_score_game(game_id))
  with check (public.can_score_game(game_id));

create policy "lineups: members read" on public.lineup_states for select to authenticated
  using (public.league_role(public.league_of_game(game_id)) is not null);
create policy "lineups: scorekeeper writes" on public.lineup_states for all to authenticated
  using (public.can_score_game(game_id))
  with check (public.can_score_game(game_id));

create policy "stats: members read" on public.player_game_stats for select to authenticated
  using (public.league_role(public.league_of_game(game_id)) is not null);
create policy "stats: scorekeeper writes" on public.player_game_stats for all to authenticated
  using (public.can_score_game(game_id))
  with check (public.can_score_game(game_id));
