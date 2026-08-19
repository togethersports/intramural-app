-- 0014 — identity, lineups, the sub pool, and per-league appearance.
--
-- Four additions, all additive. Nothing here removes a column, a policy or a
-- power anyone already had; every new grant sits alongside the admin grants
-- rather than replacing them.
--
--   1. People get a face and a position: profiles already carried avatar_url
--      and positions[], but nothing wrote to them. Adds the appearance blob
--      so a person can override the league's palette for themselves.
--   2. Captains get their own team: rename it, re-badge it, set each
--      player's position, and split the roster into a starting lineup and
--      reserves. Previously only a commissioner could touch a team row.
--   3. Players can put their hand up as a sub for the whole league.
--   4. Storage for the two public image kinds — player photos and the
--      league / team badges.
--
-- Idempotent, and guarded so the PGlite harness (no storage schema) can run
-- it as plain Postgres.

-- ------------------------------------------------------------- 1. profiles

-- Personal palette override. Empty object means "use the league's".
alter table public.profiles
  add column if not exists appearance jsonb not null default '{}'::jsonb;

-- ------------------------------------------------------- 2. team identity

alter table public.team_members add column if not exists position text;

-- Who starts. The lineup is a property of the roster rather than of a game
-- so a captain can set it once between games; the live console still writes
-- its own per-game lineup_states and is unaffected by this.
alter table public.team_members
  add column if not exists lineup_role text not null default 'reserve';
alter table public.team_members
  add column if not exists lineup_order smallint;

alter table public.team_members drop constraint if exists team_members_lineup_role_check;
alter table public.team_members add constraint team_members_lineup_role_check
  check (lineup_role in ('starter', 'reserve'));

-- Captain of a specific team. Mirrors is_league_admin: coalesced so a
-- non-member reads as false rather than as SQL NULL, which in an `if not ...`
-- guard would silently skip the check.
create or replace function public.is_team_captain(p_team uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    exists (
      select 1
      from public.teams t
      where t.id = p_team
        and t.captain_id = auth.uid()
    )
    or exists (
      select 1
      from public.team_members tm
      where tm.team_id = p_team
        and tm.user_id = auth.uid()
        and tm.is_captain
        and tm.left_at is null
    ),
    false
  )
$$;

-- A captain may edit their own team's card — name, abbrev, colour, badge —
-- but not create or delete teams, and not move a team between seasons.
-- Admin policies are untouched and still cover everything.
drop policy if exists "teams: captain updates own" on public.teams;
create policy "teams: captain updates own" on public.teams
  for update to authenticated
  using (public.is_team_captain(id))
  with check (public.is_team_captain(id));

-- A captain may edit the rows of their own roster (position, jersey, who
-- starts) but not add or remove players — roster moves stay with the draft,
-- trades and the commissioner.
drop policy if exists "rosters: captain updates own" on public.team_members;
create policy "rosters: captain updates own" on public.team_members
  for update to authenticated
  using (public.is_team_captain(team_id))
  with check (public.is_team_captain(team_id));

-- ---------------------------------------------------------- 3. the sub pool

alter table public.league_members
  add column if not exists sub_available boolean not null default false;
alter table public.league_members
  add column if not exists sub_note text;

create index if not exists league_members_sub_idx
  on public.league_members (league_id)
  where sub_available and status = 'active';

-- Anyone may put their own hand up. The existing admin-update policy is
-- unchanged; this only ever matches the caller's own row, and it cannot be
-- used to self-promote because the new role must equal the old one.
drop policy if exists "members: own sub flag" on public.league_members;
create policy "members: own sub flag" on public.league_members
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and role = public.league_role(league_id)
    and status = 'active'
  );

-- ------------------------------------------------- league identity by admin

-- The console is gated on is_league_admin, so an admin could open the
-- settings form and then be refused by a commissioner-only policy. Widen the
-- write to match the surface. Commissioners keep everything they had.
drop policy if exists "leagues: commissioner updates" on public.leagues;
drop policy if exists "leagues: admins update" on public.leagues;
create policy "leagues: admins update" on public.leagues
  for update to authenticated
  using (public.is_league_admin(id))
  with check (public.is_league_admin(id));

-- ------------------------------------------------------------- 4. storage
-- Two public buckets. Public because these images are shown on rosters,
-- brackets and box scores that any member can already see, and signing every
-- avatar on a 60-player page would be 60 round trips.
--
--   avatars/<user_id>/<file>    — a person's own photo
--   badges/<league_id>/<file>   — the league crest and its team badges

do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    return;
  end if;

  insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true), ('badges', 'badges', true)
  on conflict (id) do update set public = true;

  begin
    execute $pol$
      drop policy if exists "avatars: public read" on storage.objects
    $pol$;
    execute $pol$
      create policy "avatars: public read" on storage.objects
      for select using (bucket_id = 'avatars')
    $pol$;

    execute $pol$
      drop policy if exists "avatars: own write" on storage.objects
    $pol$;
    execute $pol$
      create policy "avatars: own write" on storage.objects
      for all to authenticated
      using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
      with check (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
    $pol$;

    execute $pol$
      drop policy if exists "badges: public read" on storage.objects
    $pol$;
    execute $pol$
      create policy "badges: public read" on storage.objects
      for select using (bucket_id = 'badges')
    $pol$;

    -- Captains upload team badges into their own league's folder, so the
    -- write is scoped to the league rather than to one team's subfolder.
    execute $pol$
      drop policy if exists "badges: league staff write" on storage.objects
    $pol$;
    execute $pol$
      create policy "badges: league staff write" on storage.objects
      for all to authenticated
      using (
        bucket_id = 'badges'
        and public.league_role(((storage.foldername(name))[1])::uuid)
            in ('commissioner', 'admin', 'captain')
      )
      with check (
        bucket_id = 'badges'
        and public.league_role(((storage.foldername(name))[1])::uuid)
            in ('commissioner', 'admin', 'captain')
      )
    $pol$;
  exception
    when insufficient_privilege then
      raise notice 'Could not create storage.objects policies — add them in the Supabase dashboard (Storage → avatars / badges → Policies).';
    when duplicate_object then
      null; -- re-run
  end;
end
$$;

notify pgrst, 'reload schema';
