-- Draft: one per season. Snake or linear order over teams; picks assign
-- players to rosters. make_pick / auto_pick / undo_last_pick RPCs hold the
-- turn logic server-side.

-- In-app inbox. Created here because draft RPCs write to it; used by every
-- later feature (schedule changes, finals, trades).
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  league_id uuid references public.leagues (id) on delete cascade,
  category text not null,
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create trigger notifications_updated_at before update on public.notifications
  for each row execute function public.set_updated_at();

alter table public.notifications enable row level security;

create policy "notifications: own read" on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy "notifications: own update" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- members may notify people they share a league with (trade offers, nudges);
-- system notifications come from security-definer RPCs.
create policy "notifications: shared-league insert" on public.notifications
  for insert to authenticated
  with check (public.shares_league_with(user_id));

create table public.drafts (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null unique references public.seasons (id) on delete cascade,
  format text not null default 'snake' check (format in ('snake', 'linear')),
  pick_seconds smallint not null default 60 check (pick_seconds between 10 and 600),
  status text not null default 'setup'
    check (status in ('setup', 'live', 'paused', 'complete')),
  current_pick_no int not null default 1,
  rounds smallint not null default 5 check (rounds between 1 and 20),
  pick_order jsonb not null default '[]'::jsonb, -- array of team ids, round 1 order
  last_pick_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.draft_picks (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.drafts (id) on delete cascade,
  pick_no int not null,
  round smallint not null,
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  auto_picked boolean not null default false,
  made_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (draft_id, pick_no),
  unique (draft_id, user_id)
);
create index draft_picks_draft_idx on public.draft_picks (draft_id);

create table public.draft_queues (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.drafts (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rank int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (draft_id, team_id, user_id)
);
create index draft_queues_team_idx on public.draft_queues (draft_id, team_id);

create trigger drafts_updated_at before update on public.drafts
  for each row execute function public.set_updated_at();
create trigger draft_picks_updated_at before update on public.draft_picks
  for each row execute function public.set_updated_at();
create trigger draft_queues_updated_at before update on public.draft_queues
  for each row execute function public.set_updated_at();

create or replace function public.league_of_draft(p_draft uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select public.league_of_season(season_id) from public.drafts where id = p_draft
$$;

-- ----------------------------------------------------------------------- RLS

alter table public.drafts enable row level security;
alter table public.draft_picks enable row level security;
alter table public.draft_queues enable row level security;

create policy "drafts: members read" on public.drafts for select to authenticated
  using (public.league_role(public.league_of_season(season_id)) is not null);
create policy "drafts: admins write" on public.drafts for all to authenticated
  using (public.is_league_admin(public.league_of_season(season_id)))
  with check (public.is_league_admin(public.league_of_season(season_id)));

create policy "picks: members read" on public.draft_picks for select to authenticated
  using (public.league_role(public.league_of_draft(draft_id)) is not null);
-- picks are written only via RPCs (security definer)

create policy "queues: own team" on public.draft_queues for all to authenticated
  using (
    public.is_league_admin(public.league_of_draft(draft_id))
    or exists (select 1 from public.teams t where t.id = team_id and t.captain_id = auth.uid())
  )
  with check (
    public.is_league_admin(public.league_of_draft(draft_id))
    or exists (select 1 from public.teams t where t.id = team_id and t.captain_id = auth.uid())
  );

-- ---------------------------------------------------------------------- RPCs

-- Which team owns pick N (1-based), given snake/linear order.
create or replace function public.draft_pick_team(p_draft uuid, p_pick_no int)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare
  v drafts;
  n int;
  idx int;
  rnd int;
begin
  select * into v from drafts where id = p_draft;
  if v.id is null then return null; end if;
  n := jsonb_array_length(v.pick_order);
  if n = 0 or p_pick_no < 1 then return null; end if;
  rnd := ((p_pick_no - 1) / n) + 1;
  idx := (p_pick_no - 1) % n;
  if v.format = 'snake' and rnd % 2 = 0 then
    idx := n - 1 - idx;
  end if;
  return (v.pick_order ->> idx)::uuid;
end $$;

-- Players who can still be drafted in this draft's season.
create or replace function public.draft_eligible(p_draft uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.drafts d
    join public.seasons s on s.id = d.season_id
    join public.league_members lm
      on lm.league_id = s.league_id
     and lm.user_id = p_user
     and lm.status = 'active'
     and lm.role in ('player', 'captain')
    where d.id = p_draft
      and not exists (
        select 1 from public.team_members tm
        join public.teams t on t.id = tm.team_id
        where t.season_id = s.id and tm.user_id = p_user and tm.left_at is null
      )
  )
$$;

-- Shared pick path. NOT exposed to clients directly.
create or replace function public.do_pick(p_draft uuid, p_user uuid, p_auto boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v drafts;
  v_team uuid;
  v_n int;
  v_round int;
  v_next_team uuid;
  v_next_captain uuid;
  v_league uuid;
begin
  select * into v from drafts where id = p_draft for update;
  if v.status <> 'live' then raise exception 'Draft is not live'; end if;
  if not draft_eligible(p_draft, p_user) then
    raise exception 'Player is not available to draft';
  end if;

  v_team := draft_pick_team(p_draft, v.current_pick_no);
  v_n := jsonb_array_length(v.pick_order);
  v_round := ((v.current_pick_no - 1) / v_n) + 1;

  insert into draft_picks (draft_id, pick_no, round, team_id, user_id, auto_picked)
  values (p_draft, v.current_pick_no, v_round, v_team, p_user, p_auto);

  insert into team_members (team_id, user_id)
  values (v_team, p_user)
  on conflict do nothing;

  delete from draft_queues where draft_id = p_draft and user_id = p_user;

  if v.current_pick_no >= v.rounds * v_n then
    update drafts set status = 'complete', last_pick_at = now() where id = p_draft;
  else
    update drafts
      set current_pick_no = current_pick_no + 1, last_pick_at = now()
      where id = p_draft;
    -- nudge the next captain
    v_next_team := draft_pick_team(p_draft, v.current_pick_no + 1);
    select captain_id into v_next_captain from teams where id = v_next_team;
    v_league := league_of_draft(p_draft);
    if v_next_captain is not null then
      insert into notifications (user_id, league_id, category, title, body, link)
      select v_next_captain, v_league, 'draft_clock', 'You''re on the clock',
             'Pick ' || (v.current_pick_no + 1) || ' is yours.', null;
    end if;
  end if;
end $$;

-- Captain (or admin) makes the current pick.
create or replace function public.make_pick(p_draft uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v drafts;
  v_team uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into v from drafts where id = p_draft for update;
  if v.id is null then raise exception 'Draft not found'; end if;
  v_team := draft_pick_team(p_draft, v.current_pick_no);
  if not (
    is_league_admin(league_of_draft(p_draft))
    or exists (select 1 from teams t where t.id = v_team and t.captain_id = auth.uid())
  ) then
    raise exception 'It is not your pick';
  end if;
  perform do_pick(p_draft, p_user, false);
end $$;

-- Anyone in the league can trigger the auto-pick once the clock expires:
-- queue first, then best available (alphabetical for now).
create or replace function public.auto_pick(p_draft uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v drafts;
  v_team uuid;
  v_user uuid;
begin
  if league_role(league_of_draft(p_draft)) is null then
    raise exception 'Not a member of this league';
  end if;
  select * into v from drafts where id = p_draft for update;
  if v.status <> 'live' then raise exception 'Draft is not live'; end if;
  if v.last_pick_at is null
     or now() < v.last_pick_at + make_interval(secs => v.pick_seconds) then
    raise exception 'The pick clock has not expired';
  end if;

  v_team := draft_pick_team(p_draft, v.current_pick_no);

  select q.user_id into v_user
  from draft_queues q
  where q.draft_id = p_draft and q.team_id = v_team
    and draft_eligible(p_draft, q.user_id)
  order by q.rank asc limit 1;

  if v_user is null then
    select lm.user_id into v_user
    from league_members lm
    join profiles p on p.id = lm.user_id
    where lm.league_id = league_of_draft(p_draft)
      and lm.status = 'active' and lm.role in ('player', 'captain')
      and draft_eligible(p_draft, lm.user_id)
    order by p.full_name asc limit 1;
  end if;

  if v_user is null then
    update drafts set status = 'complete' where id = p_draft;
    return;
  end if;

  perform do_pick(p_draft, v_user, true);
end $$;

-- Commissioner tools.
create or replace function public.undo_last_pick(p_draft uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_pick draft_picks;
begin
  if not is_league_admin(league_of_draft(p_draft)) then
    raise exception 'Only league admins can undo picks';
  end if;
  select * into v_pick from draft_picks
  where draft_id = p_draft order by pick_no desc limit 1 for update;
  if v_pick.id is null then raise exception 'No picks to undo'; end if;

  delete from draft_picks where id = v_pick.id;
  delete from team_members
  where team_id = v_pick.team_id and user_id = v_pick.user_id and left_at is null;
  update drafts
    set current_pick_no = v_pick.pick_no,
        status = case when status = 'complete' then 'live' else status end,
        last_pick_at = now()
    where id = p_draft;
end $$;

revoke execute on function
  public.do_pick, public.make_pick, public.auto_pick, public.undo_last_pick
from public, anon;
grant execute on function
  public.make_pick, public.auto_pick, public.undo_last_pick
to authenticated;
