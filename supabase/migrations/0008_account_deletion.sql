-- In-app account deletion (App Store Guideline 5.1.1(v): any app offering
-- account creation must offer account deletion).
--
-- Deleting the auth user cascades through the FK graph. Personal data goes;
-- league artifacts survive with attribution nulled. Two FKs had to be fixed
-- first — as written they would have destroyed OTHER people's data.

-- ------------------------------------------------- fix destructive cascades

-- game_events.created_by is the scorekeeper. On cascade, one scorekeeper
-- deleting their account would delete every event they ever recorded —
-- taking every other player's stat line and the whole play-by-play with it.
-- The event must outlive the person who typed it.
alter table public.game_events
  alter column created_by drop not null;
alter table public.game_events
  drop constraint game_events_created_by_fkey;
alter table public.game_events
  add constraint game_events_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

-- trades.proposed_by: the transaction log is meant to be permanent
-- ("on the record"). Losing the proposer shouldn't erase the trade.
alter table public.trades
  alter column proposed_by drop not null;
alter table public.trades
  drop constraint trades_proposed_by_fkey;
alter table public.trades
  add constraint trades_proposed_by_fkey
  foreign key (proposed_by) references auth.users (id) on delete set null;

-- The insert policy on game_events checks created_by = auth.uid(); with the
-- column now nullable, restate it so a null can never be inserted directly.
drop policy if exists "events: scorekeeper writes" on public.game_events;
create policy "events: scorekeeper writes" on public.game_events
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.can_score_game(game_id)
    and exists (select 1 from public.games g where g.id = game_id and g.status = 'live')
  );

-- ------------------------------------------------------------ the RPC

/*
  What deletion removes (via cascade): profile, league memberships, roster
  spots, availability, draft picks and queue entries, notifications, push
  subscriptions, notification prefs, personal stat lines, and the game
  events attributed to them as a player.

  What survives, de-attributed: games and their scores, teams (captain_id
  nulled), feed posts (author_id nulled), trades (proposed_by nulled),
  rule documents, audit log entries.

  A commissioner cannot delete while they still run a league — that would
  leave the league unadministrable. They must hand off or delete it first,
  and the error says so.
*/
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_league text;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  select l.name into v_league
  from league_members lm
  join leagues l on l.id = lm.league_id
  where lm.user_id = v_uid
    and lm.role = 'commissioner'
    and lm.status = 'active'
  limit 1;

  if v_league is not null then
    raise exception 'You still run %. Make someone else commissioner there, then delete your account.', v_league;
  end if;

  delete from auth.users where id = v_uid;
end $$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
