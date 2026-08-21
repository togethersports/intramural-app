-- One uploaded document can be *the* rule sheet.
--
-- Rule files were a list of downloads: a rulebook PDF sat next to a waiver
-- and a code of conduct, all equal, all one click away from being read. A
-- league usually has one document that IS the rules, and it should be on the
-- page rather than behind a link. This is that flag.
--
-- The partial unique index is the whole enforcement: at most one primary per
-- league, checked by the database rather than by whichever code path last
-- wrote. Clearing then setting is two statements; the index makes the
-- half-way state impossible to commit.

alter table public.rule_files
  add column if not exists is_primary boolean not null default false;

create unique index if not exists rule_files_one_primary_per_league
  on public.rule_files (league_id)
  where is_primary;
