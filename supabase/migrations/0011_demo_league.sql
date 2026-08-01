-- In-app demo league mode. A commissioner can populate a fully realistic
-- league (8 teams, 60 rostered players, a played season, trades, a live
-- playoff bracket) with one click so the product is reviewable before any
-- real data exists, then tear it down with one click.
--
-- The 60 "ghost" players are real auth.users + profiles rows, created once
-- by scripts/seed-ghost-players.mjs (service-role, run manually — see that
-- file). They are a fixed, shared pool: the same ghost ids are reused
-- across every commissioner's demo league. The app itself never creates
-- auth.users and never holds the service-role key — this migration only
-- adds narrow RPCs for the two operations RLS otherwise has no client path
-- for at all (league_members and trades are insert-only via RPC, per the
-- comments in 0001 and 0005), each gated to leagues explicitly flagged
-- `is_demo`.

-- Bug fix, found while testing the RPCs below: league_role() returns SQL
-- NULL (not the text 'player' etc.) for someone who isn't a member of the
-- league at all, so `league_role(x) in ('commissioner','admin')` is also
-- NULL for them — and NULL propagates through `in (...)` correctly, but
-- `if not is_league_admin(x) then raise ...` does NOT: plpgsql treats a
-- NULL condition as false and skips the raise. In a policy's `using`/`with
-- check` clause NULL already reads as "row excluded", so those were always
-- safe; the exposure was specifically plpgsql guards written as `if not
-- is_league_admin(...) then raise`, which silently passed for a caller who
-- shares no membership with the league at all — undo_last_pick,
-- resolve_trade and cancel_trade all guard this way. Fixing the shared
-- helper once fixes every call site instead of patching each guard.
create or replace function public.is_league_admin(p_league uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.league_role(p_league) in ('commissioner', 'admin'), false)
$$;

alter table public.leagues add column is_demo boolean not null default false;
create index leagues_demo_idx on public.leagues (is_demo) where is_demo;

-- Bulk-enrolls ghost players as league members (role: player) so RLS that
-- keys off league_members (profile visibility, notification eligibility)
-- resolves for them. Real leagues get no such bulk path — only a demo
-- league's own commissioner, and only while it stays flagged as one.
create or replace function public.seed_demo_roster(p_league uuid, p_user_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_league_admin(p_league) then
    raise exception 'Only a league admin can seed a demo roster';
  end if;
  if not coalesce((select is_demo from public.leagues where id = p_league), false) then
    raise exception 'seed_demo_roster only runs against demo leagues';
  end if;
  insert into public.league_members (league_id, user_id, role)
  select p_league, u, 'player' from unnest(p_user_ids) as u
  on conflict (league_id, user_id) do nothing;
end $$;

-- Proposes and immediately executes a trade as the calling commissioner —
-- skipping the captain-acceptance step real trades require, since ghost
-- players never sign in to accept anything. Reuses propose_trade for
-- validation/notifications/logging, then the same internal executor
-- respond_trade/resolve_trade call.
create or replace function public.seed_demo_trade(
  p_season uuid, p_from_team uuid, p_to_team uuid,
  p_offer uuid[], p_request uuid[]
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_league uuid := public.league_of_season(p_season);
  v_trade uuid;
begin
  if not public.is_league_admin(v_league) then
    raise exception 'Only a league admin can seed a demo trade';
  end if;
  if not coalesce((select is_demo from public.leagues where id = v_league), false) then
    raise exception 'seed_demo_trade only runs against demo leagues';
  end if;
  v_trade := public.propose_trade(p_season, p_from_team, p_to_team, p_offer, p_request, 'Demo trade');
  perform public.execute_trade_internal(v_trade);
  return v_trade;
end $$;

revoke execute on function public.seed_demo_roster, public.seed_demo_trade from public, anon;
grant execute on function public.seed_demo_roster, public.seed_demo_trade to authenticated;
