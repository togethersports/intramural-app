-- Seasons, time slots, venues, teams, rosters.

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  num_weeks smallint not null default 6 check (num_weeks between 1 and 30),
  status text not null default 'setup'
    check (status in ('setup', 'draft', 'active', 'playoffs', 'complete')),
  playoff_format jsonb not null default '{"type":"single_elim"}'::jsonb,
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index seasons_league_idx on public.seasons (league_id);

create table public.time_slots (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  label text not null,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  kind text not null default 'lunch' check (kind in ('lunch', 'free', 'after_school')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index time_slots_league_idx on public.time_slots (league_id);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  name text not null,
  capacity smallint not null default 1,
  splittable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index venues_league_idx on public.venues (league_id);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  name text not null,
  abbrev text not null default '',
  color text not null default '#54749b',
  logo_url text,
  captain_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index teams_season_idx on public.teams (season_id);

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  jersey_number smallint check (jersey_number between 0 and 99),
  is_captain boolean not null default false,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index team_members_team_idx on public.team_members (team_id) where left_at is null;
create index team_members_user_idx on public.team_members (user_id) where left_at is null;
-- one active stint per player per team
create unique index team_members_active_uniq on public.team_members (team_id, user_id)
  where left_at is null;

create trigger seasons_updated_at before update on public.seasons
  for each row execute function public.set_updated_at();
create trigger time_slots_updated_at before update on public.time_slots
  for each row execute function public.set_updated_at();
create trigger venues_updated_at before update on public.venues
  for each row execute function public.set_updated_at();
create trigger teams_updated_at before update on public.teams
  for each row execute function public.set_updated_at();
create trigger team_members_updated_at before update on public.team_members
  for each row execute function public.set_updated_at();

-- --------------------------------------------------------------- RLS helpers

create or replace function public.league_of_season(p_season uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select league_id from public.seasons where id = p_season
$$;

create or replace function public.league_of_team(p_team uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select s.league_id from public.teams t join public.seasons s on s.id = t.season_id
  where t.id = p_team
$$;

create or replace function public.is_league_admin(p_league uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.league_role(p_league) in ('commissioner', 'admin')
$$;

-- ----------------------------------------------------------------------- RLS

alter table public.seasons enable row level security;
alter table public.time_slots enable row level security;
alter table public.venues enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;

create policy "seasons: members read" on public.seasons for select to authenticated
  using (public.league_role(league_id) is not null);
create policy "seasons: admins write" on public.seasons for all to authenticated
  using (public.is_league_admin(league_id))
  with check (public.is_league_admin(league_id));

create policy "slots: members read" on public.time_slots for select to authenticated
  using (public.league_role(league_id) is not null);
create policy "slots: admins write" on public.time_slots for all to authenticated
  using (public.is_league_admin(league_id))
  with check (public.is_league_admin(league_id));

create policy "venues: members read" on public.venues for select to authenticated
  using (public.league_role(league_id) is not null);
create policy "venues: admins write" on public.venues for all to authenticated
  using (public.is_league_admin(league_id))
  with check (public.is_league_admin(league_id));

create policy "teams: members read" on public.teams for select to authenticated
  using (public.league_role(public.league_of_season(season_id)) is not null);
create policy "teams: admins write" on public.teams for all to authenticated
  using (public.is_league_admin(public.league_of_season(season_id)))
  with check (public.is_league_admin(public.league_of_season(season_id)));

create policy "rosters: members read" on public.team_members for select to authenticated
  using (public.league_role(public.league_of_team(team_id)) is not null);
create policy "rosters: admins write" on public.team_members for all to authenticated
  using (public.is_league_admin(public.league_of_team(team_id)))
  with check (public.is_league_admin(public.league_of_team(team_id)));
