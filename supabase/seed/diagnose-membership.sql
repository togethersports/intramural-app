-- "No team yet" on the watch, but the SQL editor can see the roster row.
--
-- The SQL editor bypasses RLS; the app does not. Every table the watch has
-- to read to resolve a team — team_members, teams, seasons, leagues — gates
-- SELECT on `league_role(...) is not null`, and that function requires a
-- `league_members` row with **status = 'active'**.
--
-- So a roster row without an active league membership is real, visible here,
-- and invisible to the person it belongs to. The watch's query succeeds and
-- returns nothing, which is why it shows the empty state rather than an
-- error — the read was not refused, there was simply nothing readable.
--
-- Step 1 finds it. Step 2 fixes it. Nothing here is app-specific: the same
-- gap makes the web app's league pages empty too.

-- ---------------------------------------------------------------- step 1
-- Every account, every roster row, and whether the league membership that
-- would make it visible actually exists.
select
  u.email,
  l.name  as league,
  t.name  as team,
  lm.status                     as league_membership,
  lm.role                       as league_role,
  case
    when lm.id is null          then 'INVISIBLE — no league_members row'
    when lm.status <> 'active'  then 'INVISIBLE — membership is ' || lm.status
    else 'ok'
  end as verdict
from public.team_members tm
join auth.users u     on u.id = tm.user_id
join public.teams t   on t.id = tm.team_id
join public.seasons s on s.id = t.season_id
join public.leagues l on l.id = s.league_id
left join public.league_members lm
       on lm.league_id = l.id and lm.user_id = u.id
where tm.left_at is null
order by u.email, l.name;

-- ---------------------------------------------------------------- step 2
-- Give every roster row the active membership it needs. Adds nothing for
-- rows that are already fine, and repairs a 'removed' membership rather
-- than duplicating it (league_members is unique on league_id + user_id).
--
-- Scoped to one account on purpose — widen the email filter only if you
-- mean to repair everyone.

insert into public.league_members (league_id, user_id, role, status)
select distinct s.league_id, tm.user_id, 'player', 'active'
from public.team_members tm
join public.teams t   on t.id = tm.team_id
join public.seasons s on s.id = t.season_id
join auth.users u     on u.id = tm.user_id
where tm.left_at is null
  and lower(u.email) = lower('YOUR-EMAIL@example.com')
on conflict (league_id, user_id) do update
  set status = 'active',
      updated_at = now();

-- Re-run step 1. Every row should now read 'ok'.
