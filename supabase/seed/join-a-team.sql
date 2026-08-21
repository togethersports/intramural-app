-- Put yourself on a team roster, so the watch and the player surfaces have
-- something to show.
--
-- Being a league member is not the same as being on a team: membership is
-- who is in the league, a roster row is who plays for whom. Everything the
-- watch draws — today's fixture, the live game, your stat line, the sub
-- flag — keys off the roster row, so a commissioner who never got drafted
-- correctly sees "No team yet".
--
-- Replace the two values below, then run in the Supabase SQL editor.
-- The email is the one you sign in with; the slug is from the app URL
-- after /league/.
--
-- Joins through auth.users rather than profiles.email on purpose, so this
-- works whether or not migration 0015 has been applied yet.

insert into public.team_members (team_id, user_id, is_captain)
select t.id, u.id, true
from public.teams t
join public.seasons s on s.id = t.season_id
join public.leagues l on l.id = s.league_id
join auth.users u on lower(u.email) = lower('YOUR-EMAIL@example.com')
where l.slug = 'YOUR-LEAGUE-SLUG'
  and t.is_external = false
  and not exists (
    select 1
    from public.team_members existing
    join public.teams et on et.id = existing.team_id
    where existing.user_id = u.id
      and et.season_id = s.id
      and existing.left_at is null
  )
order by t.created_at
limit 1;

-- Where you ended up.
select l.name as league, s.name as season, t.name as team,
       tm.is_captain, tm.jersey_number
from public.team_members tm
join public.teams t on t.id = tm.team_id
join public.seasons s on s.id = t.season_id
join public.leagues l on l.id = s.league_id
join auth.users u on u.id = tm.user_id
where lower(u.email) = lower('YOUR-EMAIL@example.com')
  and tm.left_at is null;

-- Nothing inserted and nothing listed? The season has no teams yet. Create
-- one in the app first (League → Teams), or load the demo league from the
-- dashboard, which builds eight of them with a full season behind it.
