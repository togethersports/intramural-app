-- 0024 — a sub from another team, for one game
--
-- "Kushner's team is short; Sheldon from another team plays for them today,
-- and what he does in that game counts toward his own averages."
--
-- The averages already work: season totals group stat lines by player, not
-- by the team on the line, so anything recorded under Sheldon's user id is
-- his wherever he played. What was missing is a way for the scorekeeper to
-- put him on Kushner's side for the game — and a record of it, so he is
-- still there after a refresh or on a second phone.
--
-- That record already has a home: sub_requests, the table behind the
-- ask-and-approve sub flow. An approved request IS "this person plays for
-- this team in this game". The scorekeeper's direct add simply writes one
-- that starts approved, through a function that checks what the row policy
-- cannot: that the caller runs this game, that the sub belongs to the
-- league, and that they aren't already playing for either side.

-- ------------------------------------------- whether it counts, per sub
-- The commissioner's call, per sub per game: a ringer from the top team
-- padding his own averages in a blowout is a different thing from a regular
-- helping out a short side. On by default — that is the ordinary case.
-- When off, finalizing stores the sub's line by name for this game only
-- (the way a walk-on guest's is), so the game's box score still shows what
-- they did but nothing season-long ever reads it.

alter table public.sub_requests
  add column if not exists counts_toward_stats boolean not null default true;

-- ------------------------------------------------- the scorekeeper's add

drop function if exists public.add_game_sub(uuid, uuid, uuid);
create or replace function public.add_game_sub(
  p_game uuid, p_team uuid, p_user uuid, p_counts boolean default true
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_game games;
  v_id uuid;
begin
  if not public.can_score_game(p_game) then
    raise exception 'Only this game''s scorekeeper or a league admin can add a sub';
  end if;
  if not p_counts and not public.is_league_admin(public.league_of_game(p_game)) then
    raise exception 'Only the commissioner can choose not to count a sub''s stats';
  end if;

  select * into v_game from games where id = p_game;
  if v_game.status not in ('scheduled', 'live') then
    raise exception 'Subs can only be added before or during a game';
  end if;
  if p_team is distinct from v_game.home_team_id and p_team is distinct from v_game.away_team_id then
    raise exception 'That team isn''t playing in this game';
  end if;

  if not exists (
    select 1 from league_members
    where league_id = public.league_of_game(p_game) and user_id = p_user and status = 'active'
  ) then
    raise exception 'Only members of this league can sub in';
  end if;

  -- Already on a roster in this game — either side. Subbing for your own
  -- team is just playing; subbing for the opponent is playing both sides.
  if exists (
    select 1 from team_members
    where user_id = p_user and left_at is null
      and team_id in (v_game.home_team_id, v_game.away_team_id)
  ) then
    raise exception 'That player is already on a team in this game';
  end if;

  -- Re-adding the same person to the same side is a no-op, not a duplicate.
  select id into v_id from sub_requests
  where game_id = p_game and team_id = p_team and fill_user_id = p_user and status = 'approved';
  if v_id is not null then
    return v_id;
  end if;

  -- Already subbing for the other side in this game.
  if exists (
    select 1 from sub_requests
    where game_id = p_game and fill_user_id = p_user and status = 'approved'
  ) then
    raise exception 'That player is already subbing for the other team';
  end if;

  insert into sub_requests (
    game_id, team_id, requested_by, fill_user_id,
    scope, status, approved_by, decided_at, note, counts_toward_stats
  ) values (
    p_game, p_team, auth.uid(), p_user,
    'league', 'approved', auth.uid(), now(), 'Added by the scorekeeper', p_counts
  )
  returning id into v_id;
  return v_id;
end $$;

-- Flip the choice afterwards. Commissioner only, and only until the game is
-- final — finalizing is when the choice is written into the stat lines.
create or replace function public.set_game_sub_counts(p_request uuid, p_counts boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v sub_requests;
begin
  select * into v from sub_requests where id = p_request;
  if v.id is null or v.status <> 'approved' then
    raise exception 'That sub is no longer on this game';
  end if;
  if not public.is_league_admin(public.league_of_game(v.game_id)) then
    raise exception 'Only the commissioner can choose whether a sub''s stats count';
  end if;
  if exists (select 1 from games where id = v.game_id and status not in ('scheduled', 'live')) then
    raise exception 'This game is already final — its stat lines are written';
  end if;
  update sub_requests set counts_toward_stats = p_counts where id = p_request;
end $$;

-- Taking a sub back off — for the wrong name picked from the list. Refused
-- once they have stats in the game: removing them would leave plays credited
-- to someone who isn't on either side. Undo the plays first.
create or replace function public.remove_game_sub(p_request uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v sub_requests;
begin
  select * into v from sub_requests where id = p_request;
  if v.id is null or v.status <> 'approved' then
    raise exception 'That sub is no longer on this game';
  end if;
  if not public.can_score_game(v.game_id) then
    raise exception 'Only this game''s scorekeeper or a league admin can remove a sub';
  end if;
  if exists (
    select 1 from game_events
    where game_id = v.game_id and user_id = v.fill_user_id and not voided
  ) then
    raise exception 'They already have stats in this game — undo those first, then remove them';
  end if;
  update sub_requests set status = 'cancelled' where id = p_request;
end $$;

revoke execute on function public.add_game_sub(uuid, uuid, uuid, boolean) from public, anon;
revoke execute on function public.remove_game_sub(uuid) from public, anon;
revoke execute on function public.set_game_sub_counts(uuid, boolean) from public, anon;
grant execute on function public.add_game_sub(uuid, uuid, uuid, boolean) to authenticated;
grant execute on function public.remove_game_sub(uuid) to authenticated;
grant execute on function public.set_game_sub_counts(uuid, boolean) to authenticated;

-- ------------------------------------------------- closing the side door
-- The insert policy checked only who was asking, not what they wrote, so a
-- client could insert a request that was already 'approved' for anyone it
-- liked. Harmless while approved subs went nowhere; not once the live
-- console puts them on a roster. A new request starts undecided: open, or
-- proposed (naming a fill the other captain still has to approve). Approval
-- only ever comes from decide_sub_request, or the scorekeeper's add above.

drop policy if exists "subs: members open" on public.sub_requests;
create policy "subs: members open" on public.sub_requests
  for insert to authenticated
  with check (
    requested_by = auth.uid()
    and public.league_role(public.league_of_game(game_id)) is not null
    and status in ('open', 'proposed')
    and approved_by is null
    and decided_at is null
  );
