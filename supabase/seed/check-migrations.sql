with expected (migration, kind, thing) as (
  values
    ('0014', 'column', 'profiles.appearance'),
    ('0014', 'column', 'team_members.position'),
    ('0014', 'column', 'team_members.lineup_role'),
    ('0014', 'column', 'league_members.sub_available'),
    ('0015', 'column', 'profiles.email'),
    ('0015', 'column', 'profiles.phone'),
    ('0015', 'column', 'profiles.notify_channel'),
    ('0015', 'column', 'leagues.timezone'),
    ('0015', 'column', 'league_members.player_status'),
    ('0015', 'table',  'game_absences'),
    ('0015', 'table',  'sub_requests'),
    ('0015', 'table',  'schedule_polls'),
    ('0015', 'table',  'schedule_poll_options'),
    ('0015', 'table',  'schedule_poll_votes'),
    ('0015', 'table',  'game_recaps'),
    ('0015', 'table',  'weekly_awards'),
    ('0015', 'table',  'reminder_log'),
    ('0015', 'view',   'game_schedule')
)
select
  e.migration,
  e.thing,
  case when e.kind = 'column' then
    (select count(*) > 0 from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = split_part(e.thing, '.', 1)
        and c.column_name = split_part(e.thing, '.', 2))
  else
    (select count(*) > 0 from information_schema.tables t
      where t.table_schema = 'public' and t.table_name = e.thing)
  end as present
from expected e
order by e.migration, e.thing;
