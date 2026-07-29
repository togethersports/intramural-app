-- Makes the schema self-sufficient on a fresh Supabase project:
--   1. realtime publication membership (the draft room and the live game
--      view subscribe to postgres_changes — without this they never fire and
--      the UI silently falls back to polling)
--   2. replica identity so realtime payloads carry the row and filters match
--   3. explicit privileges for the anon / authenticated roles
--
-- Every block is guarded so the file also applies to a plain Postgres used
-- for testing, where the publication and Supabase roles do not exist.

-- ------------------------------------------------------------- realtime

do $$
declare
  t text;
  realtime_tables text[] := array[
    'drafts', 'draft_picks', 'draft_queues',
    'games', 'game_events', 'lineup_states',
    'posts', 'notifications', 'trades', 'bracket_nodes'
  ];
begin
  -- Replica identity full: realtime needs the whole row to evaluate the
  -- `filter` clauses the client subscribes with (e.g. game_id=eq.<uuid>).
  foreach t in array realtime_tables loop
    execute format('alter table public.%I replica identity full', t);
  end loop;

  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array realtime_tables loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- ------------------------------------------------------------- privileges
-- RLS does the real gating; these are the coarse grants Supabase's roles
-- need before any policy is even consulted.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant usage on schema public to authenticated;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant usage, select on all sequences in schema public to authenticated;
    alter default privileges in schema public
      grant select, insert, update, delete on tables to authenticated;
  end if;

  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant usage on schema public to anon;
    -- anon reads nothing today (every policy is `to authenticated`); the
    -- grant exists so public league pages can be opened up by policy alone.
    grant select on all tables in schema public to anon;
    alter default privileges in schema public grant select on tables to anon;
  end if;
end $$;
