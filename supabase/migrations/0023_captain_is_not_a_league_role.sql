-- 0023 — captaincy stops being a league role
--
-- `league_members.role` held one value out of commissioner / admin /
-- captain / player / spectator, so a captain could not also be an admin.
-- Picking either in the members list silently took the other away, and
-- `create_team` even guarded against it: it only stamped role='captain'
-- `where role = 'player'`, so promoting an admin to captain did nothing.
--
-- The fix is not a second role column. It is noticing that the database
-- already stores captaincy somewhere else and has all along: `teams.
-- captain_id`. Every real captain power reads that and not the role —
-- making a draft pick, proposing a trade, editing a roster, claiming a sub.
-- `role = 'captain'` was a label sitting next to the fact, able to disagree
-- with it.
--
-- So the role column goes back to being about the league — who can run it —
-- and captaincy stays with the team. Being both is then not a special case,
-- it is two unrelated facts.

-- ------------------------------------------------------- existing captains
-- Their captaincy is in teams.captain_id and is untouched by this. Only the
-- duplicate label moves, and it moves to 'player' so they stay in the pool
-- the draft picks from.

update public.league_members set role = 'player' where role = 'captain';

alter table public.league_members drop constraint if exists league_members_role_check;
alter table public.league_members add constraint league_members_role_check
  check (role in ('commissioner', 'admin', 'player', 'spectator'));

-- ------------------------------------------------------------ the new fact
-- "Is this person a captain anywhere in this league." Security definer for
-- the same reason league_role() is: a policy consulting teams directly would
-- recurse through the teams policies.

create or replace function public.is_league_captain(p_league uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.teams t
    join public.seasons s on s.id = t.season_id
    where s.league_id = p_league and t.captain_id = auth.uid()
  )
$$;

grant execute on function public.is_league_captain(uuid) to authenticated;

-- --------------------------------------------------------------- the pool
-- Who a draft may pick. This read 'player' or 'captain'; with the label gone
-- it would have read 'player' alone, which would have dropped anyone running
-- the league out of their own draft — the same gap that stopped a
-- commissioner appearing in the free-agent list. Everyone active except a
-- spectator is drafted; a spectator signed up to watch.

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
     and lm.role <> 'spectator'
    where d.id = p_draft
      and not exists (
        select 1 from public.team_members tm
        join public.teams t on t.id = tm.team_id
        where t.season_id = s.id and tm.user_id = p_user and tm.left_at is null
      )
  )
$$;

-- auto_pick's fallback repeated the role test next to its own
-- draft_eligible() call, so the two could disagree. It defers to
-- draft_eligible now, which is the one place the pool is decided.

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
      and lm.status = 'active'
      and draft_eligible(p_draft, lm.user_id)
    order by p.full_name asc limit 1;
  end if;

  if v_user is null then
    update drafts set status = 'complete' where id = p_draft;
    return;
  end if;

  perform do_pick(p_draft, v_user, true);
end $$;

revoke execute on function public.auto_pick(uuid) from public, anon;
grant execute on function public.auto_pick(uuid) to authenticated;

-- --------------------------------------------------------- team badge files
-- The storage policy let league staff write a team's badge and counted a
-- captain among them via the role. It has to ask the teams table now.

do $$
begin
  -- Same guard 0014 uses: the storage schema is Supabase's, so it is absent
  -- in the PGlite harness that applies every migration to assert RLS.
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    return;
  end if;

  begin
    execute $pol$
      drop policy if exists "badges: league staff write" on storage.objects
    $pol$;
    execute $pol$
      create policy "badges: league staff write" on storage.objects
      for all to authenticated
      using (
        bucket_id = 'badges'
        and (
          public.league_role(((storage.foldername(name))[1])::uuid)
              in ('commissioner', 'admin')
          or public.is_league_captain(((storage.foldername(name))[1])::uuid)
        )
      )
      with check (
        bucket_id = 'badges'
        and (
          public.league_role(((storage.foldername(name))[1])::uuid)
              in ('commissioner', 'admin')
          or public.is_league_captain(((storage.foldername(name))[1])::uuid)
        )
      )
    $pol$;
  exception
    when insufficient_privilege then
      raise notice 'Could not update storage.objects policy — set it in the Supabase dashboard (Storage → badges → Policies).';
    when duplicate_object then
      null; -- re-run
  end;
end $$;
