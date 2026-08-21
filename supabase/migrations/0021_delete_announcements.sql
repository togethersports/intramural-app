-- Taking an announcement back.
--
-- 0017 gave announcements a read policy and nothing else, because posting one
-- is a multi-table fact only an RPC can express. Deleting one is not: "an
-- admin of this league may delete this league's announcements" is exactly
-- what a row policy says, so it is a row policy.
--
-- The harder half is the inbox. Posting fanned a notification out to every
-- member, and those rows had no link back — deleting the announcement would
-- have left the message sitting in everyone's inbox, which is the opposite
-- of taking it back. So notifications gain a nullable announcement_id, the
-- RPC stamps it, and the cascade does the retraction.

alter table public.notifications
  add column if not exists announcement_id uuid
    references public.announcements (id) on delete cascade;

create index if not exists notifications_announcement_idx
  on public.notifications (announcement_id)
  where announcement_id is not null;

drop policy if exists "announcements: admins delete" on public.announcements;
create policy "announcements: admins delete" on public.announcements
  for delete to authenticated
  using (public.is_league_admin(league_id));

-- Same body as 0017, with the announcement's id carried onto the inbox rows
-- it creates. (CREATE OR REPLACE keeps the existing grants.)
create or replace function public.announce_league(
  p_league uuid,
  p_title text,
  p_body text default ''
)
returns table (token text, bundle_id text)
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_announcement uuid;
begin
  if not coalesce(public.is_league_admin(p_league), false) then
    raise exception 'Only a league admin can post an announcement.';
  end if;
  if p_title is null or btrim(p_title) = '' then
    raise exception 'The announcement needs a title.';
  end if;

  insert into public.announcements (league_id, author_id, title, body)
  values (p_league, v_me, btrim(p_title), coalesce(btrim(p_body), ''))
  returning id into v_announcement;

  -- Everyone but the author — people do not need to be buzzed about their
  -- own words. The inbox row is unconditional; whether a *push* also goes
  -- out is decided per device below, and 'none' in notify_channel stays the
  -- global mute it is everywhere else.
  insert into public.notifications
    (user_id, league_id, category, title, body, link, announcement_id)
  select lm.user_id, p_league, 'announcement', btrim(p_title),
         coalesce(btrim(p_body), ''),
         '/league/' || (select l.slug from public.leagues l where l.id = p_league),
         v_announcement
  from public.league_members lm
  where lm.league_id = p_league
    and lm.status = 'active'
    and lm.user_id <> v_me;

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

notify pgrst, 'reload schema';
