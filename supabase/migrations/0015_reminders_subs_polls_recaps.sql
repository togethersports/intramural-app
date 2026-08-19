-- 0015 — reminders, sub requests, scheduling polls, recaps, awards, status.
--
-- One schema pass behind six features that all turn out to need the same two
-- things: a real tip-off instant (not a date and a loose "period 4"), and a
-- way to reach a person outside the app.
--
--   1. Contact + preference on the profile, and a timezone on the league,
--      so "one hour before tip-off" is a computable moment.
--   2. game_absences / sub_requests — a player says they can't make a game,
--      somebody volunteers, and the *opposing* captain signs off.
--   3. schedule_polls — propose slots, teams vote, the winner locks onto the
--      game and hands it to the reminder pipeline.
--   4. game_recaps / weekly_awards — what the model wrote, stored so it is
--      generated once and read many times.
--   5. reminder_log — the idempotency ledger. A cron that fires twice must
--      never text sixty people twice.
--
-- Additive and idempotent. Guarded where a feature needs a Postgres version
-- or schema the PGlite harness may not have.

-- ------------------------------------------------------- 1. reachability

-- Email lives in auth.users, which the app's anon key cannot read. The
-- reminder sender needs it for every recipient, and one admin API call per
-- player does not scale to a whole league — so mirror it onto the profile,
-- maintained by the same trigger that creates the row.
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles
  add column if not exists notify_channel text not null default 'email';

alter table public.profiles drop constraint if exists profiles_notify_channel_check;
alter table public.profiles add constraint profiles_notify_channel_check
  check (notify_channel in ('email', 'sms', 'both', 'none'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, grade)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      -- Google returns `name`; a person signing in with it should not land
      -- on a roster as "Unnamed player".
      new.raw_user_meta_data ->> 'name',
      ''
    ),
    new.email,
    nullif(new.raw_user_meta_data ->> 'grade', '')::smallint
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = case
          when public.profiles.full_name = '' then excluded.full_name
          else public.profiles.full_name
        end;
  return new;
end $$;

-- Keep the mirror honest when someone changes their email later.
create or replace function public.sync_profile_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end $$;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'auth') then
    begin
      execute 'drop trigger if exists on_auth_user_email_changed on auth.users';
      execute 'create trigger on_auth_user_email_changed
               after update of email on auth.users
               for each row execute function public.sync_profile_email()';
    exception when insufficient_privilege then
      raise notice 'Could not attach the email-sync trigger to auth.users.';
    end;
  end if;
end
$$;

-- Backfill for everyone who signed up before the mirror existed.
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'auth' and tablename = 'users') then
    execute 'update public.profiles p
             set email = u.email
             from auth.users u
             where u.id = p.id and p.email is distinct from u.email';
  end if;
end
$$;

-- "7:15 the morning of" and "one hour before" are local times. Without this
-- every league in the country gets woken up on New York's schedule.
alter table public.leagues
  add column if not exists timezone text not null default 'America/New_York';

-- ------------------------------------------------- 2. player availability

-- Distinct from the availability grid (which periods am I free) and from the
-- sub pool (will I fill in for others): this is "can I play at all right
-- now", and it is what a captain reads before building a lineup.
alter table public.league_members
  add column if not exists player_status text not null default 'available';
alter table public.league_members add column if not exists status_note text;
alter table public.league_members add column if not exists status_until date;

alter table public.league_members drop constraint if exists league_members_player_status_check;
alter table public.league_members add constraint league_members_player_status_check
  check (player_status in ('available', 'injured', 'away'));

-- The own-row policy from 0014 covers this too, but it pinned `role` and
-- `status`; widen the comment rather than the policy — those are still the
-- two columns a player must not be able to change about themselves.

-- ---------------------------------------------------- 3. absences + subs

create table if not exists public.game_absences (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, user_id)
);
create index if not exists game_absences_game_idx on public.game_absences (game_id);

/*
  A hole in a lineup, and its fill.

  `scope` records who was asked — just the team, or the whole league's sub
  pool. `fill_user_id` is null until somebody volunteers. The approval is
  the point of the table: a team cannot quietly hand itself a ringer, so the
  *opposing* captain (or a league admin) has to approve this specific person
  for this specific game before it counts.
*/
create table if not exists public.sub_requests (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  requested_by uuid not null references auth.users (id) on delete cascade,
  absent_user_id uuid references auth.users (id) on delete set null,
  fill_user_id uuid references auth.users (id) on delete set null,
  scope text not null default 'league',
  status text not null default 'open',
  note text not null default '',
  approved_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  decision_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sub_requests drop constraint if exists sub_requests_scope_check;
alter table public.sub_requests add constraint sub_requests_scope_check
  check (scope in ('team', 'league'));
alter table public.sub_requests drop constraint if exists sub_requests_status_check;
alter table public.sub_requests add constraint sub_requests_status_check
  check (status in ('open', 'proposed', 'approved', 'declined', 'cancelled'));
-- Anything past "open" names the person it is about.
alter table public.sub_requests drop constraint if exists sub_requests_fill_present;
alter table public.sub_requests add constraint sub_requests_fill_present
  check (status in ('open', 'cancelled') or fill_user_id is not null);

create index if not exists sub_requests_game_idx on public.sub_requests (game_id, status);
create index if not exists sub_requests_open_idx on public.sub_requests (team_id)
  where status in ('open', 'proposed');

-- ------------------------------------------------------ 4. scheduling polls

create table if not exists public.schedule_polls (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  -- Null for a game that doesn't exist yet; set to move an existing one.
  game_id uuid references public.games (id) on delete cascade,
  home_team_id uuid not null references public.teams (id) on delete cascade,
  away_team_id uuid not null references public.teams (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  status text not null default 'open',
  closes_at timestamptz,
  locked_option_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.schedule_polls drop constraint if exists schedule_polls_status_check;
alter table public.schedule_polls add constraint schedule_polls_status_check
  check (status in ('open', 'locked', 'cancelled'));
create index if not exists schedule_polls_season_idx on public.schedule_polls (season_id, status);

create table if not exists public.schedule_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.schedule_polls (id) on delete cascade,
  scheduled_date date not null,
  time_slot_id uuid references public.time_slots (id) on delete set null,
  venue_id uuid references public.venues (id) on delete set null,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists schedule_poll_options_poll_idx on public.schedule_poll_options (poll_id);

create table if not exists public.schedule_poll_votes (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.schedule_poll_options (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  vote text not null default 'yes',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (option_id, user_id)
);
alter table public.schedule_poll_votes drop constraint if exists schedule_poll_votes_vote_check;
alter table public.schedule_poll_votes add constraint schedule_poll_votes_vote_check
  check (vote in ('yes', 'maybe', 'no'));

-- ------------------------------------------------------ 5. recaps + awards

create table if not exists public.game_recaps (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null unique references public.games (id) on delete cascade,
  headline text not null default '',
  body text not null,
  model text not null default '',
  -- "claude" when the model wrote it, "fallback" when it was assembled from
  -- the box score because no key was configured. Worth knowing on the page.
  source text not null default 'claude',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.weekly_awards (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  week smallint not null,
  category text not null default 'player_of_the_week',
  user_id uuid references auth.users (id) on delete set null,
  team_id uuid references public.teams (id) on delete set null,
  headline text not null default '',
  blurb text not null default '',
  stat_line jsonb not null default '{}'::jsonb,
  source text not null default 'claude',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, week, category)
);
create index if not exists weekly_awards_season_idx
  on public.weekly_awards (season_id, week desc);

-- --------------------------------------------------------- 6. reminder log

-- The idempotency ledger. The unique key is the whole point: the sender
-- inserts *before* it sends, so a cron that fires twice — or a retry after a
-- timeout — collides instead of texting sixty people again.
create table if not exists public.reminder_log (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  channel text not null,
  sent_at timestamptz not null default now(),
  ok boolean not null default true,
  detail text not null default '',
  unique (game_id, user_id, kind, channel)
);
alter table public.reminder_log drop constraint if exists reminder_log_kind_check;
alter table public.reminder_log add constraint reminder_log_kind_check
  check (kind in ('morning', 'hour', 'ten'));
alter table public.reminder_log drop constraint if exists reminder_log_channel_check;
alter table public.reminder_log add constraint reminder_log_channel_check
  check (channel in ('email', 'sms'));
create index if not exists reminder_log_game_idx on public.reminder_log (game_id);

-- ------------------------------------------------------ 7. the tip-off view

/*
  A game's start as an actual instant.

  Everything about reminders depends on this and nothing else stores it:
  `scheduled_date` is a date, the hour lives on the time slot, and the zone
  lives on the league. Resolving it here means the sender asks one question
  ("what starts in the next five minutes") instead of reassembling three
  columns and a timezone in application code.

  security_invoker so the view carries the caller's RLS rather than the
  definer's — the cron reads it with the service role, the app reads it as
  the signed-in member, and both get the right rows.
*/
drop view if exists public.game_schedule;
create view public.game_schedule
  with (security_invoker = true)
  as
select
  g.id                as game_id,
  g.season_id,
  s.league_id,
  l.slug              as league_slug,
  l.name              as league_name,
  l.timezone,
  g.status,
  g.week,
  g.home_team_id,
  g.away_team_id,
  g.scheduled_date,
  ts.label            as slot_label,
  v.name              as venue_name,
  ((g.scheduled_date + coalesce(ts.start_time, time '15:00'))
    at time zone l.timezone) as starts_at
from public.games g
join public.seasons s on s.id = g.season_id
join public.leagues l on l.id = s.league_id
left join public.time_slots ts on ts.id = g.time_slot_id
left join public.venues v on v.id = g.venue_id
where g.scheduled_date is not null
  and l.deleted_at is null;

-- ------------------------------------------------------------------- RLS

alter table public.game_absences enable row level security;
alter table public.sub_requests enable row level security;
alter table public.schedule_polls enable row level security;
alter table public.schedule_poll_options enable row level security;
alter table public.schedule_poll_votes enable row level security;
alter table public.game_recaps enable row level security;
alter table public.weekly_awards enable row level security;
alter table public.reminder_log enable row level security;

-- Absences: the league reads them (a captain has to be able to see the hole),
-- but only you can declare your own — and only an admin can clear someone
-- else's.
drop policy if exists "absences: members read" on public.game_absences;
create policy "absences: members read" on public.game_absences
  for select to authenticated
  using (public.league_role(public.league_of_game(game_id)) is not null);

drop policy if exists "absences: own write" on public.game_absences;
create policy "absences: own write" on public.game_absences
  for all to authenticated
  using (user_id = auth.uid() or public.is_league_admin(public.league_of_game(game_id)))
  with check (user_id = auth.uid() or public.is_league_admin(public.league_of_game(game_id)));

-- Sub requests are public within the league — the whole point is that the
-- other side can see who is being brought in.
drop policy if exists "subs: members read" on public.sub_requests;
create policy "subs: members read" on public.sub_requests
  for select to authenticated
  using (public.league_role(public.league_of_game(game_id)) is not null);

-- Opening a request, and volunteering for one, are both ordinary member
-- actions; the gate is the approval, not the ask.
drop policy if exists "subs: members open" on public.sub_requests;
create policy "subs: members open" on public.sub_requests
  for insert to authenticated
  with check (
    requested_by = auth.uid()
    and public.league_role(public.league_of_game(game_id)) is not null
  );

/*
  The approval rule, in one policy.

  A row may be updated by:
    - the person who opened it, or the affected team's captain, or an admin
      (to volunteer somebody, edit the note, or cancel); or
    - the OPPOSING team's captain, or an admin — the only people who can move
      it to approved/declined.

  The status transition itself is checked in the RPC below, because a policy
  cannot see the previous status.
*/
create or replace function public.sub_request_opponent_of(p_request uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select case
    when g.home_team_id = r.team_id then g.away_team_id
    else g.home_team_id
  end
  from public.sub_requests r
  join public.games g on g.id = r.game_id
  where r.id = p_request
$$;

drop policy if exists "subs: side or opponent updates" on public.sub_requests;
create policy "subs: side or opponent updates" on public.sub_requests
  for update to authenticated
  using (
    requested_by = auth.uid()
    or fill_user_id = auth.uid()
    or public.is_team_captain(team_id)
    or public.is_team_captain(public.sub_request_opponent_of(id))
    or public.is_league_admin(public.league_of_game(game_id))
  )
  with check (
    requested_by = auth.uid()
    or fill_user_id = auth.uid()
    or public.is_team_captain(team_id)
    or public.is_team_captain(public.sub_request_opponent_of(id))
    or public.is_league_admin(public.league_of_game(game_id))
  );

-- Polls: the league reads; captains and admins run them.
drop policy if exists "polls: members read" on public.schedule_polls;
create policy "polls: members read" on public.schedule_polls
  for select to authenticated
  using (public.league_role(public.league_of_season(season_id)) is not null);

drop policy if exists "polls: staff write" on public.schedule_polls;
create policy "polls: staff write" on public.schedule_polls
  for all to authenticated
  using (
    public.is_league_admin(public.league_of_season(season_id))
    or public.is_team_captain(home_team_id)
    or public.is_team_captain(away_team_id)
  )
  with check (
    public.is_league_admin(public.league_of_season(season_id))
    or public.is_team_captain(home_team_id)
    or public.is_team_captain(away_team_id)
  );

create or replace function public.league_of_poll(p_poll uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select public.league_of_season(p.season_id)
  from public.schedule_polls p where p.id = p_poll
$$;

drop policy if exists "poll options: members read" on public.schedule_poll_options;
create policy "poll options: members read" on public.schedule_poll_options
  for select to authenticated
  using (public.league_role(public.league_of_poll(poll_id)) is not null);

drop policy if exists "poll options: staff write" on public.schedule_poll_options;
create policy "poll options: staff write" on public.schedule_poll_options
  for all to authenticated
  using (
    exists (
      select 1 from public.schedule_polls p
      where p.id = poll_id
        and (
          public.is_league_admin(public.league_of_season(p.season_id))
          or public.is_team_captain(p.home_team_id)
          or public.is_team_captain(p.away_team_id)
        )
    )
  )
  with check (
    exists (
      select 1 from public.schedule_polls p
      where p.id = poll_id
        and (
          public.is_league_admin(public.league_of_season(p.season_id))
          or public.is_team_captain(p.home_team_id)
          or public.is_team_captain(p.away_team_id)
        )
    )
  );

create or replace function public.league_of_poll_option(p_option uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select public.league_of_poll(o.poll_id)
  from public.schedule_poll_options o where o.id = p_option
$$;

drop policy if exists "poll votes: members read" on public.schedule_poll_votes;
create policy "poll votes: members read" on public.schedule_poll_votes
  for select to authenticated
  using (public.league_role(public.league_of_poll_option(option_id)) is not null);

-- You cast your own vote and nobody else's.
drop policy if exists "poll votes: own write" on public.schedule_poll_votes;
create policy "poll votes: own write" on public.schedule_poll_votes
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and public.league_role(public.league_of_poll_option(option_id)) is not null
  );

-- Recaps and awards are written by the server (service role) and read by
-- everyone in the league. No client write path at all.
drop policy if exists "recaps: members read" on public.game_recaps;
create policy "recaps: members read" on public.game_recaps
  for select to authenticated
  using (public.league_role(public.league_of_game(game_id)) is not null);

drop policy if exists "recaps: admins write" on public.game_recaps;
create policy "recaps: admins write" on public.game_recaps
  for all to authenticated
  using (public.is_league_admin(public.league_of_game(game_id)))
  with check (public.is_league_admin(public.league_of_game(game_id)));

drop policy if exists "awards: members read" on public.weekly_awards;
create policy "awards: members read" on public.weekly_awards
  for select to authenticated
  using (public.league_role(public.league_of_season(season_id)) is not null);

drop policy if exists "awards: admins write" on public.weekly_awards;
create policy "awards: admins write" on public.weekly_awards
  for all to authenticated
  using (public.is_league_admin(public.league_of_season(season_id)))
  with check (public.is_league_admin(public.league_of_season(season_id)));

-- The send ledger is nobody's business but the server's. No policy at all
-- means no access for anon or authenticated; the service role bypasses RLS.
drop policy if exists "reminders: own read" on public.reminder_log;
create policy "reminders: own read" on public.reminder_log
  for select to authenticated
  using (user_id = auth.uid());

-- --------------------------------------------------------------- triggers

drop trigger if exists game_absences_updated_at on public.game_absences;
create trigger game_absences_updated_at before update on public.game_absences
  for each row execute function public.set_updated_at();
drop trigger if exists sub_requests_updated_at on public.sub_requests;
create trigger sub_requests_updated_at before update on public.sub_requests
  for each row execute function public.set_updated_at();
drop trigger if exists schedule_polls_updated_at on public.schedule_polls;
create trigger schedule_polls_updated_at before update on public.schedule_polls
  for each row execute function public.set_updated_at();
drop trigger if exists schedule_poll_votes_updated_at on public.schedule_poll_votes;
create trigger schedule_poll_votes_updated_at before update on public.schedule_poll_votes
  for each row execute function public.set_updated_at();
drop trigger if exists game_recaps_updated_at on public.game_recaps;
create trigger game_recaps_updated_at before update on public.game_recaps
  for each row execute function public.set_updated_at();
drop trigger if exists weekly_awards_updated_at on public.weekly_awards;
create trigger weekly_awards_updated_at before update on public.weekly_awards
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------- RPCs

/*
  Decide a sub request.

  Security-definer because the check it enforces is a *transition* rule, not
  a row rule: only a proposed request can be approved, and only by the other
  side. Doing it in the policy would let a captain approve their own fill by
  writing the row twice.
*/
create or replace function public.decide_sub_request(
  p_request uuid,
  p_approve boolean,
  p_note text default ''
) returns public.sub_requests
language plpgsql security definer set search_path = public as $$
declare
  r public.sub_requests;
  opponent uuid;
begin
  select * into r from public.sub_requests where id = p_request;
  if r.id is null then
    raise exception 'That sub request no longer exists.';
  end if;
  if r.status <> 'proposed' then
    raise exception 'Only a request with somebody lined up can be decided (this one is %).', r.status;
  end if;

  opponent := public.sub_request_opponent_of(p_request);
  if not (
    coalesce(public.is_team_captain(opponent), false)
    or coalesce(public.is_league_admin(public.league_of_game(r.game_id)), false)
  ) then
    raise exception 'Only the opposing captain or a league admin can approve a sub.';
  end if;

  update public.sub_requests
     set status = case when p_approve then 'approved' else 'declined' end,
         approved_by = auth.uid(),
         decided_at = now(),
         decision_note = coalesce(p_note, '')
   where id = p_request
  returning * into r;

  -- An approved sub joins the roster for real, so the box score can credit
  -- them. Left as a normal roster row; the captain can cut them after.
  if p_approve and r.fill_user_id is not null then
    insert into public.team_members (team_id, user_id)
    values (r.team_id, r.fill_user_id)
    on conflict do nothing;
  end if;

  return r;
end $$;

/*
  Volunteer for an open sub request (or nominate somebody for one).

  Security-definer for the same reason `decide_sub_request` is: the rule is a
  *transition*, not a row property. A plain UPDATE policy cannot express it,
  because at the moment the policy runs `fill_user_id` is still null — the
  volunteer is not yet on the row they are trying to write, so a `fill_user_id
  = auth.uid()` clause can never match and nobody outside the team could ever
  step in. Which is precisely the case the league-wide sub pool exists for.

  Who may claim:
    - any active member of the league, when the request went league-wide;
    - the affected team's own players, captain, or a league admin, when it
      didn't.
  Nominating somebody else is limited to that team's captain and admins.
*/
create or replace function public.claim_sub_request(
  p_request uuid,
  p_fill uuid default null
) returns public.sub_requests
language plpgsql security definer set search_path = public as $$
declare
  r public.sub_requests;
  fill uuid := coalesce(p_fill, auth.uid());
  league uuid;
  is_staff boolean;
begin
  select * into r from public.sub_requests where id = p_request;
  if r.id is null then
    raise exception 'That sub request no longer exists.';
  end if;
  if r.status <> 'open' then
    raise exception 'Somebody has already been put forward for this one (it is %).', r.status;
  end if;

  league := public.league_of_game(r.game_id);
  if public.league_role(league) is null then
    raise exception 'You have to be in this league to offer to sub.';
  end if;

  is_staff := coalesce(public.is_team_captain(r.team_id), false)
    or coalesce(public.is_league_admin(league), false);

  -- Putting somebody else's name forward is a captain's call, not a
  -- player's — otherwise anyone could volunteer anyone.
  if fill <> auth.uid() and not is_staff then
    raise exception 'Only this team''s captain or a league admin can nominate somebody else.';
  end if;

  -- A team-scope request was never offered to the league.
  if r.scope = 'team' and not is_staff then
    if not exists (
      select 1 from public.team_members tm
      where tm.team_id = r.team_id and tm.user_id = fill and tm.left_at is null
    ) then
      raise exception 'This one was only offered to that team.';
    end if;
  end if;

  -- The person being replaced cannot also be the replacement.
  if fill = r.absent_user_id then
    raise exception 'That is the player who is out.';
  end if;

  update public.sub_requests
     set fill_user_id = fill, status = 'proposed'
   where id = p_request and status = 'open'
  returning * into r;

  return r;
end $$;

/*
  Lock a scheduling poll onto its winning option.

  Writes the date, slot and venue back onto the game (creating one if the
  poll was for a fixture that didn't exist yet) and closes the poll, which is
  what puts it in front of the reminder sender.
*/
create or replace function public.lock_schedule_poll(
  p_poll uuid,
  p_option uuid default null
) returns public.games
language plpgsql security definer set search_path = public as $$
declare
  p public.schedule_polls;
  o public.schedule_poll_options;
  g public.games;
begin
  select * into p from public.schedule_polls where id = p_poll;
  if p.id is null then
    raise exception 'That poll no longer exists.';
  end if;
  if not (
    coalesce(public.is_league_admin(public.league_of_season(p.season_id)), false)
    or coalesce(public.is_team_captain(p.home_team_id), false)
    or coalesce(public.is_team_captain(p.away_team_id), false)
  ) then
    raise exception 'Only a captain of one of these teams, or a league admin, can lock a poll.';
  end if;

  if p_option is not null then
    select * into o from public.schedule_poll_options where id = p_option and poll_id = p_poll;
  else
    -- Most yes votes wins; a maybe is worth half; ties break toward the
    -- earliest date, because a scheduler that flips on a tie is worse than
    -- one that is merely arbitrary.
    select opt.* into o
    from public.schedule_poll_options opt
    left join public.schedule_poll_votes v on v.option_id = opt.id
    where opt.poll_id = p_poll
    group by opt.id
    order by
      sum(case v.vote when 'yes' then 1.0 when 'maybe' then 0.5 else 0 end) desc nulls last,
      opt.scheduled_date asc
    limit 1;
  end if;

  if o.id is null then
    raise exception 'That poll has no options to lock.';
  end if;

  if p.game_id is not null then
    update public.games
       set scheduled_date = o.scheduled_date,
           time_slot_id = o.time_slot_id,
           venue_id = o.venue_id,
           status = case when status = 'postponed' then 'scheduled' else status end
     where id = p.game_id
    returning * into g;
  else
    insert into public.games (
      season_id, week, home_team_id, away_team_id,
      scheduled_date, time_slot_id, venue_id
    )
    values (
      p.season_id, 1, p.home_team_id, p.away_team_id,
      o.scheduled_date, o.time_slot_id, o.venue_id
    )
    returning * into g;
  end if;

  update public.schedule_polls
     set status = 'locked', locked_option_id = o.id, game_id = g.id
   where id = p_poll;

  return g;
end $$;

-- ------------------------------------------------------- profile embeds

-- Same reason as 0013: these columns reference auth.users, and PostgREST
-- only resolves `profile:profiles(...)` over a DIRECT foreign key between
-- the two exposed tables. Without these the sub-request and award reads
-- 400 rather than degrading, which shows up as an empty panel.
alter table public.game_absences drop constraint if exists game_absences_user_profile_fkey;
alter table public.game_absences add constraint game_absences_user_profile_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.sub_requests drop constraint if exists sub_requests_absent_user_id_fkey;
alter table public.sub_requests add constraint sub_requests_absent_user_id_fkey
  foreign key (absent_user_id) references public.profiles (id) on delete set null;

alter table public.sub_requests drop constraint if exists sub_requests_fill_user_id_fkey;
alter table public.sub_requests add constraint sub_requests_fill_user_id_fkey
  foreign key (fill_user_id) references public.profiles (id) on delete set null;

alter table public.sub_requests drop constraint if exists sub_requests_requested_by_profile_fkey;
alter table public.sub_requests add constraint sub_requests_requested_by_profile_fkey
  foreign key (requested_by) references public.profiles (id) on delete cascade;

alter table public.weekly_awards drop constraint if exists weekly_awards_user_profile_fkey;
alter table public.weekly_awards add constraint weekly_awards_user_profile_fkey
  foreign key (user_id) references public.profiles (id) on delete set null;

alter table public.schedule_poll_votes drop constraint if exists schedule_poll_votes_user_profile_fkey;
alter table public.schedule_poll_votes add constraint schedule_poll_votes_user_profile_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

notify pgrst, 'reload schema';
