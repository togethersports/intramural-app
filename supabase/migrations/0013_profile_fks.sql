-- Direct foreign keys to public.profiles for every user column the app
-- embeds a profile through (`profile:profiles(full_name)` and friends).
--
-- These columns reference auth.users, and profiles.id also references
-- auth.users — but PostgREST only resolves an embed over a DIRECT foreign
-- key between the two exposed tables. Where that inference doesn't hold,
-- the whole query 400s, and empty-looking pages (members list "0 active",
-- rosters with no players) are the symptom. A real FK makes the
-- relationship explicit and guaranteed.
--
-- Semantics are unchanged: profiles rows are created for every user by the
-- signup trigger and deleted exactly when the auth.users row is deleted,
-- so each new FK's on-delete matches the existing auth.users FK on the
-- same column. Idempotent — safe to run twice.

alter table public.league_members drop constraint if exists league_members_user_profile_fkey;
alter table public.league_members add constraint league_members_user_profile_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.team_members drop constraint if exists team_members_user_profile_fkey;
alter table public.team_members add constraint team_members_user_profile_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.draft_picks drop constraint if exists draft_picks_user_profile_fkey;
alter table public.draft_picks add constraint draft_picks_user_profile_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.draft_queues drop constraint if exists draft_queues_user_profile_fkey;
alter table public.draft_queues add constraint draft_queues_user_profile_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.player_game_stats drop constraint if exists pgs_user_profile_fkey;
alter table public.player_game_stats add constraint pgs_user_profile_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.trade_items drop constraint if exists trade_items_user_profile_fkey;
alter table public.trade_items add constraint trade_items_user_profile_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.posts drop constraint if exists posts_author_profile_fkey;
alter table public.posts add constraint posts_author_profile_fkey
  foreign key (author_id) references public.profiles (id) on delete set null;

-- Tell PostgREST to pick up the new relationships right away instead of
-- waiting for its periodic schema-cache reload.
notify pgrst, 'reload schema';
