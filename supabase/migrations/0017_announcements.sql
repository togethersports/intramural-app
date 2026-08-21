-- Commissioner announcements.
--
-- One write, three deliveries: the announcement row (the record), an inbox
-- notification per member (the in-app surface), and — outside the database —
-- a push to every registered device (the wrist/pocket surface, sent by the
-- caller from the token list this returns).
--
-- The whole thing is a security-definer RPC rather than table policies
-- because the interesting rule is not "who may insert an announcements row"
-- but "posting one must atomically notify the whole league" — a multi-table
-- fact no row policy can express. The announcement and its notifications
-- either all land or none do.

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  -- set null, not cascade: the message outlives the account that wrote it.
  author_id uuid references auth.users (id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists announcements_league_idx
  on public.announcements (league_id, created_at desc);

-- PostgREST can only embed the author's profile through a *direct* FK —
-- inference does not cross auth.users. Same fix as 0013 and 0015.
alter table public.announcements drop constraint if exists announcements_author_profile_fkey;
alter table public.announcements add constraint announcements_author_profile_fkey
  foreign key (author_id) references public.profiles (id) on delete set null;

alter table public.announcements enable row level security;

drop policy if exists "announcements: members read" on public.announcements;
create policy "announcements: members read" on public.announcements
  for select to authenticated
  using (public.league_role(league_id) is not null);
-- No insert/update/delete policies: writes go through announce_league() only.

-- ------------------------------------------------------------------- RPC

create or replace function public.announce_league(
  p_league uuid,
  p_title text,
  p_body text default ''
)
returns table (token text, bundle_id text)
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
begin
  if not coalesce(public.is_league_admin(p_league), false) then
    raise exception 'Only a league admin can post an announcement.';
  end if;
  if p_title is null or btrim(p_title) = '' then
    raise exception 'The announcement needs a title.';
  end if;

  insert into public.announcements (league_id, author_id, title, body)
  values (p_league, v_me, btrim(p_title), coalesce(btrim(p_body), ''));

  -- Everyone but the author — people do not need to be buzzed about their
  -- own words. The inbox row is unconditional; whether a *push* also goes
  -- out is decided per device below, and 'none' in notify_channel stays the
  -- global mute it is everywhere else.
  insert into public.notifications (user_id, league_id, category, title, body, link)
  select lm.user_id, p_league, 'announcement', btrim(p_title),
         coalesce(btrim(p_body), ''),
         '/league/' || (select l.slug from public.leagues l where l.id = p_league)
  from public.league_members lm
  where lm.league_id = p_league
    and lm.status = 'active'
    and lm.user_id <> v_me;

  -- The caller (a server with the APNs key; this never reaches a browser)
  -- delivers to these. Guarded by the admin check above, so the only person
  -- who can obtain a league's tokens is someone entitled to buzz it anyway.
  return query
  select dt.token, dt.bundle_id
  from public.device_tokens dt
  join public.league_members lm
    on lm.user_id = dt.user_id and lm.league_id = p_league and lm.status = 'active'
  join public.profiles p on p.id = dt.user_id
  where dt.invalidated_at is null
    and dt.user_id <> v_me
    and p.notify_channel <> 'none';
end;
$$;

revoke all on function public.announce_league(uuid, text, text) from public;
grant execute on function public.announce_league(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
