-- Phase 0: foundation
-- profiles, organizations, leagues, league_members
-- + auth trigger, join-by-code / create-league RPCs, RLS on everything.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- utilities

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ------------------------------------------------------------------- tables

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  email_domain text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  grade smallint check (grade between 1 and 13),
  height_in smallint check (height_in between 36 and 96),
  jersey_pref smallint check (jersey_pref between 0 and 99),
  positions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations (id) on delete set null,
  name text not null,
  slug text not null unique,
  sport text not null default 'basketball'
    check (sport in ('basketball', 'soccer', 'volleyball', 'flag_football', 'dodgeball')),
  logo_url text,
  primary_color text not null default '#c8232c',
  join_code text not null unique,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'player'
    check (role in ('commissioner', 'admin', 'captain', 'player', 'spectator')),
  status text not null default 'active'
    check (status in ('active', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, user_id)
);

create index league_members_league_idx on public.league_members (league_id) where status = 'active';
create index league_members_user_idx on public.league_members (user_id) where status = 'active';

create trigger organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger leagues_updated_at before update on public.leagues
  for each row execute function public.set_updated_at();
create trigger league_members_updated_at before update on public.league_members
  for each row execute function public.set_updated_at();

-- ------------------------------------------------- profile bootstrap on signup

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, grade)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'grade', '')::smallint
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------------------------------- RLS helpers
-- security definer so policies can consult league_members without recursion.

create or replace function public.league_role(p_league uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from public.league_members
  where league_id = p_league and user_id = auth.uid() and status = 'active'
$$;

create or replace function public.shares_league_with(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.league_members a
    join public.league_members b on a.league_id = b.league_id
    where a.user_id = auth.uid() and a.status = 'active'
      and b.user_id = p_user and b.status = 'active'
  )
$$;

-- ----------------------------------------------------------------------- RLS

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;

create policy "orgs readable by signed-in users"
  on public.organizations for select to authenticated using (true);

create policy "profiles: own or shared-league"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_league_with(id));
create policy "profiles: insert own"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "leagues: members read"
  on public.leagues for select to authenticated
  using (public.league_role(id) is not null);
create policy "leagues: commissioner updates"
  on public.leagues for update to authenticated
  using (public.league_role(id) = 'commissioner')
  with check (public.league_role(id) = 'commissioner');
create policy "leagues: commissioner deletes"
  on public.leagues for delete to authenticated
  using (public.league_role(id) = 'commissioner');
-- inserts happen only through the create_league() RPC (security definer)

create policy "members: fellow members read"
  on public.league_members for select to authenticated
  using (public.league_role(league_id) is not null);
-- Admins manage members, but cannot touch the commissioner's row and cannot
-- grant the commissioner role. Only role/status changes are expected.
create policy "members: admins update"
  on public.league_members for update to authenticated
  using (
    public.league_role(league_id) in ('commissioner', 'admin')
    and not (role = 'commissioner' and user_id <> auth.uid())
  )
  with check (
    role <> 'commissioner' or public.league_role(league_id) = 'commissioner'
  );
create policy "members: leave or admin remove"
  on public.league_members for delete to authenticated
  using (
    user_id = auth.uid()
    or (
      public.league_role(league_id) in ('commissioner', 'admin')
      and role <> 'commissioner'
    )
  );
-- inserts happen only through RPCs (security definer)

-- ----------------------------------------------------------------------- RPCs

create or replace function public.create_league(
  p_name text,
  p_sport text default 'basketball',
  p_color text default '#c8232c',
  p_org_name text default null
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_base text;
  v_slug text;
  v_code text;
  v_league uuid;
  v_org uuid;
  v_n int := 0;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to create a league';
  end if;
  if length(trim(p_name)) < 3 then
    raise exception 'League name must be at least 3 characters';
  end if;

  v_base := trim(both '-' from regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'));
  if v_base = '' then v_base := 'league'; end if;
  v_slug := v_base;
  while exists (select 1 from leagues where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  -- 6-char join code from an unambiguous alphabet (no I/L/O/0/1)
  loop
    select string_agg(
      substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), ''
    ) into v_code from generate_series(1, 6);
    exit when not exists (select 1 from leagues where join_code = v_code);
  end loop;

  if p_org_name is not null and trim(p_org_name) <> '' then
    select id into v_org from organizations
    where lower(name) = lower(trim(p_org_name)) limit 1;
    if v_org is null then
      insert into organizations (name, slug)
      values (
        trim(p_org_name),
        trim(both '-' from regexp_replace(lower(trim(p_org_name)), '[^a-z0-9]+', '-', 'g'))
          || '-' || substr(gen_random_uuid()::text, 1, 4)
      ) returning id into v_org;
    end if;
  end if;

  insert into leagues (org_id, name, slug, sport, primary_color, join_code)
  values (v_org, trim(p_name), v_slug, p_sport, p_color, v_code)
  returning id into v_league;

  insert into league_members (league_id, user_id, role)
  values (v_league, auth.uid(), 'commissioner');

  return v_slug;
end $$;

create or replace function public.join_league_with_code(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_league uuid;
  v_slug text;
  v_domain text;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to join a league';
  end if;

  select id, slug, settings ->> 'email_domain'
  into v_league, v_slug, v_domain
  from leagues where join_code = upper(trim(p_code));

  if v_league is null then
    raise exception 'No league found for that code';
  end if;

  if v_domain is not null and v_domain <> '' then
    select email into v_email from auth.users where id = auth.uid();
    if v_email is null or lower(v_email) not like '%@' || lower(v_domain) then
      raise exception 'This league only accepts % emails', '@' || v_domain;
    end if;
  end if;

  insert into league_members (league_id, user_id, role)
  values (v_league, auth.uid(), 'player')
  on conflict (league_id, user_id)
  do update set status = 'active', updated_at = now();

  return v_slug;
end $$;

revoke execute on function public.create_league from anon;
revoke execute on function public.join_league_with_code from anon;
grant execute on function public.create_league to authenticated;
grant execute on function public.join_league_with_code to authenticated;
