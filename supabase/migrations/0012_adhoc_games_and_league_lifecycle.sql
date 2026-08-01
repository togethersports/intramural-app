-- Ad-hoc games + league lifecycle.
--
-- Part 1 — games that exist outside the generated schedule: spun up on the
-- spot, playable immediately, against any opponent (including one that
-- isn't in the league at all), with per-game rule overrides and an
-- exhibition flag that keeps scrimmages out of the standings. Free-text
-- opponents become real `teams` rows flagged is_external so the whole
-- event/box-score pipeline works unchanged; free-text players become
-- `game_guests` rows that events and stat lines can reference in place of
-- an auth user.
--
-- Part 2 — leagues can be archived (out of the active list, kept) or
-- deleted (30-day recovery window, then hard purge).

-- --------------------------------------------------------- ad-hoc games

alter table public.teams add column if not exists is_external boolean not null default false;

alter table public.games add column if not exists is_adhoc boolean not null default false;
alter table public.games add column if not exists counts_for_standings boolean not null default true;
-- Per-game overrides of the season's game rules (periods, period_minutes,
-- foul_limit, ...) — merged over seasons.rules when the console loads.
alter table public.games add column if not exists rules_override jsonb not null default '{}'::jsonb;

-- 'abandoned': cut short mid-play; partial box score retained, never
-- counted toward standings (the standings engine counts final/forfeit only).
alter table public.games drop constraint if exists games_status_check;
alter table public.games add constraint games_status_check
  check (status in ('scheduled', 'live', 'final', 'forfeit', 'postponed', 'abandoned'));

-- ---------------------------------------------------------- guest players
-- Rostered players are auth users (team_members.user_id is a hard FK), but
-- a pickup game needs "just write down their name". Guests are scoped to a
-- single game; their ids appear in lineup arrays and event/stat rows.
-- Ids are client-supplied (uuid) so the console can create a guest OFFLINE
-- and sync them before the events that reference them.

create table if not exists public.game_guests (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  team_id uuid references public.teams (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists game_guests_game_idx on public.game_guests (game_id);

drop trigger if exists game_guests_updated_at on public.game_guests;
create trigger game_guests_updated_at before update on public.game_guests
  for each row execute function public.set_updated_at();

alter table public.game_events
  add column if not exists guest_id uuid references public.game_guests (id) on delete cascade;
alter table public.game_events drop constraint if exists game_events_one_player;
alter table public.game_events add constraint game_events_one_player
  check (user_id is null or guest_id is null);
-- subs and assists reference a second player, who can also be a guest
alter table public.game_events
  add column if not exists related_guest_id uuid references public.game_guests (id) on delete set null;
alter table public.game_events drop constraint if exists game_events_one_related;
alter table public.game_events add constraint game_events_one_related
  check (related_user_id is null or related_guest_id is null);

-- Stat lines can belong to a guest instead of a user. Exactly one of the two.
alter table public.player_game_stats alter column user_id drop not null;
alter table public.player_game_stats
  add column if not exists guest_id uuid references public.game_guests (id) on delete cascade;
alter table public.player_game_stats drop constraint if exists pgs_one_player;
alter table public.player_game_stats add constraint pgs_one_player
  check ((user_id is null) <> (guest_id is null));
create unique index if not exists pgs_game_guest_uniq
  on public.player_game_stats (game_id, guest_id) where guest_id is not null;

alter table public.game_guests enable row level security;
drop policy if exists "guests: members read" on public.game_guests;
create policy "guests: members read" on public.game_guests for select to authenticated
  using (public.league_role(public.league_of_game(game_id)) is not null);
drop policy if exists "guests: scorekeeper writes" on public.game_guests;
create policy "guests: scorekeeper writes" on public.game_guests for all to authenticated
  using (public.can_score_game(game_id))
  with check (public.can_score_game(game_id));

-- ------------------------------------------------------- league lifecycle

alter table public.leagues add column if not exists archived_at timestamptz;
alter table public.leagues add column if not exists deleted_at timestamptz;

-- A deleted league disappears for everyone except its admins, who keep
-- read access through the recovery window so they can restore it. The
-- commissioner-only update policy (0001) already covers setting/clearing
-- both timestamps.
drop policy if exists "leagues: members read" on public.leagues;
create policy "leagues: members read" on public.leagues for select to authenticated
  using (
    public.league_role(id) is not null
    and (deleted_at is null or public.is_league_admin(id))
  );

-- Hard purge after the 30-day window. No cron on the free tier — this is
-- called opportunistically (fire-and-forget from the dashboard), which is
-- plenty: the exact purge hour doesn't matter, only that expired leagues
-- eventually go away. Cascades take everything with them.
create or replace function public.purge_expired_leagues()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  delete from leagues where deleted_at < now() - interval '30 days';
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke execute on function public.purge_expired_leagues from public, anon;
grant execute on function public.purge_expired_leagues to authenticated;
