-- The school's period grid, as league time slots.
--
-- Replace YOUR-LEAGUE-SLUG below — it appears twice, once in each statement —
-- then run the whole file in the Supabase SQL editor. The slug is the part of
-- the app URL after /league/.
--
-- Safe to re-run: a period that already exists for a day is skipped, never
-- duplicated and never replaced. That matters — `availability.time_slot_id`
-- cascades on delete, so replacing a slot would silently destroy every
-- player's answer about when they are free. Correcting a time is therefore an
-- UPDATE (see the bottom of this file), not a delete plus re-insert.
--
-- day_of_week is Postgres-style: 0 = Sunday, so Monday = 1 ... Friday = 5.
-- Monday through Thursday share one grid; Friday runs on its own, with longer
-- periods and everything after FLEX shifted later.

insert into public.time_slots (league_id, label, day_of_week, start_time, end_time, kind)
select l.id, g.label, g.day_of_week, g.start_time, g.end_time, g.kind
from public.leagues l
cross join (
  values
    -- Monday–Thursday. Periods are 36 minutes, FLEX is a full hour.
    ('Period 1',  1, time '08:00', time '08:45', 'free'),
    ('Period 2',  1, time '08:49', time '09:26', 'free'),
    ('Period 3',  1, time '09:30', time '10:07', 'free'),
    ('FLEX',      1, time '10:11', time '11:11', 'free'),
    ('Period 4',  1, time '11:15', time '11:51', 'free'),
    ('Period 5',  1, time '11:55', time '12:31', 'free'),
    ('Period 6',  1, time '12:35', time '13:11', 'free'),
    ('Period 7',  1, time '13:15', time '13:51', 'lunch'),
    ('Period 8',  1, time '13:55', time '14:31', 'free'),
    ('Period 9',  1, time '14:35', time '15:11', 'free'),
    ('Period 10', 1, time '15:15', time '15:51', 'after_school'),

    ('Period 1',  2, time '08:00', time '08:45', 'free'),
    ('Period 2',  2, time '08:49', time '09:26', 'free'),
    ('Period 3',  2, time '09:30', time '10:07', 'free'),
    ('FLEX',      2, time '10:11', time '11:11', 'free'),
    ('Period 4',  2, time '11:15', time '11:51', 'free'),
    ('Period 5',  2, time '11:55', time '12:31', 'free'),
    ('Period 6',  2, time '12:35', time '13:11', 'free'),
    ('Period 7',  2, time '13:15', time '13:51', 'lunch'),
    ('Period 8',  2, time '13:55', time '14:31', 'free'),
    ('Period 9',  2, time '14:35', time '15:11', 'free'),
    ('Period 10', 2, time '15:15', time '15:51', 'after_school'),

    ('Period 1',  3, time '08:00', time '08:45', 'free'),
    ('Period 2',  3, time '08:49', time '09:26', 'free'),
    ('Period 3',  3, time '09:30', time '10:07', 'free'),
    ('FLEX',      3, time '10:11', time '11:11', 'free'),
    ('Period 4',  3, time '11:15', time '11:51', 'free'),
    ('Period 5',  3, time '11:55', time '12:31', 'free'),
    ('Period 6',  3, time '12:35', time '13:11', 'free'),
    ('Period 7',  3, time '13:15', time '13:51', 'lunch'),
    ('Period 8',  3, time '13:55', time '14:31', 'free'),
    ('Period 9',  3, time '14:35', time '15:11', 'free'),
    ('Period 10', 3, time '15:15', time '15:51', 'after_school'),

    ('Period 1',  4, time '08:00', time '08:45', 'free'),
    ('Period 2',  4, time '08:49', time '09:26', 'free'),
    ('Period 3',  4, time '09:30', time '10:07', 'free'),
    ('FLEX',      4, time '10:11', time '11:11', 'free'),
    ('Period 4',  4, time '11:15', time '11:51', 'free'),
    ('Period 5',  4, time '11:55', time '12:31', 'free'),
    ('Period 6',  4, time '12:35', time '13:11', 'free'),
    ('Period 7',  4, time '13:15', time '13:51', 'lunch'),
    ('Period 8',  4, time '13:55', time '14:31', 'free'),
    ('Period 9',  4, time '14:35', time '15:11', 'free'),
    ('Period 10', 4, time '15:15', time '15:51', 'after_school'),

    -- Friday. Periods run 40 minutes.
    ('Period 1',  5, time '08:00', time '08:45', 'free'),
    ('Period 2',  5, time '08:49', time '09:26', 'free'),
    ('Period 3',  5, time '09:30', time '10:07', 'free'),
    ('FLEX',      5, time '10:11', time '11:00', 'free'),
    ('Period 4',  5, time '11:20', time '12:00', 'free'),
    ('Period 5',  5, time '12:04', time '12:44', 'free'),
    ('Period 6',  5, time '12:50', time '13:30', 'free'),
    ('Period 7',  5, time '13:34', time '14:14', 'free'),
    ('Period 8',  5, time '14:18', time '14:58', 'free'),
    ('Period 9',  5, time '15:02', time '15:42', 'free')
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
--      and label = 'Period 7'
--      and day_of_week = 1;
