-- League rules: one editable rules document per league, plus uploaded rule
-- files (PDFs etc.) stored in a private Storage bucket, metadata here.

create table public.league_rules (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null unique references public.leagues (id) on delete cascade,
  content text not null default '',
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rule_files (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  name text not null,
  storage_path text not null unique,
  size_bytes int not null default 0,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rule_files_league_idx on public.rule_files (league_id);

create trigger league_rules_updated_at before update on public.league_rules
  for each row execute function public.set_updated_at();
create trigger rule_files_updated_at before update on public.rule_files
  for each row execute function public.set_updated_at();

alter table public.league_rules enable row level security;
alter table public.rule_files enable row level security;

create policy "rules: members read" on public.league_rules for select to authenticated
  using (public.league_role(league_id) is not null);
create policy "rules: admins write" on public.league_rules for all to authenticated
  using (public.is_league_admin(league_id))
  with check (public.is_league_admin(league_id));

create policy "rule files: members read" on public.rule_files for select to authenticated
  using (public.league_role(league_id) is not null);
create policy "rule files: admins write" on public.rule_files for all to authenticated
  using (public.is_league_admin(league_id))
  with check (public.is_league_admin(league_id));

-- ------------------------------------------------------------------ storage
-- Private bucket "rules"; object paths are "<league_id>/<filename>" so the
-- policies can scope access by league. Guarded so this migration also
-- applies to plain Postgres (the PGlite test harness has no storage schema).

do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    return;
  end if;

  insert into storage.buckets (id, name, public)
  values ('rules', 'rules', false)
  on conflict (id) do nothing;

  begin
    execute $pol$
      create policy "rules bucket: members read" on storage.objects
      for select to authenticated
      using (
        bucket_id = 'rules'
        and public.league_role(((storage.foldername(name))[1])::uuid) is not null
      )
    $pol$;
    execute $pol$
      create policy "rules bucket: admins insert" on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'rules'
        and public.is_league_admin(((storage.foldername(name))[1])::uuid)
      )
    $pol$;
    execute $pol$
      create policy "rules bucket: admins delete" on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'rules'
        and public.is_league_admin(((storage.foldername(name))[1])::uuid)
      )
    $pol$;
  exception
    when insufficient_privilege then
      raise notice 'Could not create storage.objects policies — add them in the Supabase dashboard (Storage → rules → Policies).';
    when duplicate_object then
      null; -- re-run
  end;
end $$;
