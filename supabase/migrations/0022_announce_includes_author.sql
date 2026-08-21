-- The author gets their own announcement.
--
-- 0017 excluded them on the reasoning that nobody needs to be buzzed about
-- words they just typed. In practice that made the one person who can post
-- the one person who can never see that posting worked — the commissioner
-- sends to the league and gets silence back, with no way to tell a working
-- pipeline from a broken one. Delivery you cannot observe is delivery you
-- cannot trust, so the author is now on the list like everyone else.

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

  -- Every active member, the author included.
  insert into public.notifications
    (user_id, league_id, category, title, body, link, announcement_id)
  select lm.user_id, p_league, 'announcement', btrim(p_title),
         coalesce(btrim(p_body), ''),
         '/league/' || (select l.slug from public.leagues l where l.id = p_league),
         v_announcement
  from public.league_members lm
  where lm.league_id = p_league
    and lm.status = 'active';

  -- …and every registered device, the author's included. notify_channel
  -- 'none' is still the global mute it is everywhere else, so anyone who
  -- genuinely wants silence keeps it.
  return query
  select dt.token, dt.bundle_id
  from public.device_tokens dt
  join public.league_members lm
    on lm.user_id = dt.user_id and lm.league_id = p_league and lm.status = 'active'
  join public.profiles p on p.id = dt.user_id
  where dt.invalidated_at is null
    and p.notify_channel <> 'none';
end;
$$;

notify pgrst, 'reload schema';
