-- The periods a game can actually be played in, as league time slots.
--
-- Replace YOUR-LEAGUE-SLUG below — it appears twice, once in each statement —
-- then run the whole file in the Supabase SQL editor. The slug is the part of
-- the app URL after /league/.
--
-- Only FLEX and lunch are here. The rest of the day is class, so seeding
-- those periods would just be nine more rows for everyone to mark themselves
-- busy in. Add one from Console → Time slots if a season ever needs it.
--
-- Safe to re-run: a period that already exists for a day is skipped, never
-- duplicated and never replaced. That matters — `availability.time_slot_id`
-- cascades on delete, so replacing a slot would silently destroy every
-- player's answer about when they are free. Correcting a time is therefore an
-- UPDATE (see the bottom of this file), not a delete plus re-insert.
--
-- day_of_week is Postgres-style: 0 = Sunday, so Monday = 1 ... Friday = 5.

insert into public.time_slots (league_id, label, day_of_week, start_time, end_time, kind)
select l.id, g.label, g.day_of_week, g.start_time, g.end_time, g.kind
from public.leagues l
cross join (
  values
    -- FLEX. A full hour Monday to Thursday, and the longest open block in
    -- the week — the only one with room for a game plus warmup.
    ('FLEX', 1, time '10:11', time '11:11', 'free'),
    ('FLEX', 2, time '10:11', time '11:11', 'free'),
    ('FLEX', 3, time '10:11', time '11:11', 'free'),
    ('FLEX', 4, time '10:11', time '11:11', 'free'),
    -- Friday's FLEX ends earlier; the rest of Friday runs on its own grid.
    ('FLEX', 5, time '10:11', time '11:00', 'free'),

    -- Lunch, Monday to Thursday.
    ('P7', 1, time '13:15', time '13:51', 'lunch'),
    ('P7', 2, time '13:15', time '13:51', 'lunch'),
    ('P7', 3, time '13:15', time '13:51', 'lunch'),
    ('P7', 4, time '13:15', time '13:51', 'lunch')
) as g (label, day_of_week, start_time, end_time, kind)
where l.slug = 'YOUR-LEAGUE-SLUG'
  and not exists (
    select 1
    from public.time_slots t
    where t.league_id = l.id
      and t.label = g.label
      and t.day_of_week = g.day_of_week
  );

-- What you ended up with, ordered the way a week reads.
select
  case day_of_week
    when 1 then 'Mon' when 2 then 'Tue' when 3 then 'Wed'
    when 4 then 'Thu' when 5 then 'Fri'
  end as day,
  label,
  to_char(start_time, 'HH12:MI') || ' - ' || to_char(end_time, 'HH12:MI') as runs,
  kind
from public.time_slots
where league_id = (select id from public.leagues where slug = 'YOUR-LEAGUE-SLUG')
order by day_of_week, start_time;

-- Correcting a time later, without touching anyone's availability:
--
--   update public.time_slots
--      set start_time = time '13:20', end_time = time '13:56'
--    where league_id = (select id from public.leagues where slug = 'YOUR-LEAGUE-SLUG')
--      and label = 'P7'
--      and day_of_week = 1;
--
-- Renaming lunch across every day, if the timetable calls it something else:
--
--   update public.time_slots
--      set label = 'P6'
--    where league_id = (select id from public.leagues where slug = 'YOUR-LEAGUE-SLUG')
--      and kind = 'lunch';
