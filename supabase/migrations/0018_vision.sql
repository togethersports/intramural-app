-- Intramural Vision — camera + AI stat tracking, phase V0.
--
-- The shipping decision (build plan §0): this is an ASSISTED tracker, not an
-- autonomous one. A pipeline proposes candidate events with timestamps and
-- confidence; a league admin confirms, edits, or rejects each one in the
-- review room. Nothing reaches the box score without a human keystroke.
--
-- Three things live here:
--   1. consents      — the gate. No consent on file, no processing. §7.
--   2. recordings    — one uploaded game film + its rim/court calibration.
--   3. detected_events + vision_jobs — candidates awaiting review, and the
--      job that produced them.
--
-- Deliberately NOT here (v2, build plan §5 M2): tracklets, re-ID embeddings,
-- pgvector, jersey OCR. v1 tags the shooter with a roster picker — 40 taps a
-- game, perfectly accurate, zero engineering.
--
-- Vocabulary note: detected_events reuses the `game_events` type vocabulary
-- verbatim rather than inventing `shot_made`/`shot_attempt`. Promotion is
-- then a straight copy with no mapping layer, and the reviewer edits inside
-- one vocabulary. The v1 pipeline cannot tell a two from a three (that needs
-- court homography, v2), so it emits fg2_made/fg2_miss and the reviewer
-- upgrades to three with one key.

-- ------------------------------------------------------------------ consent
-- Recording minors on school property. One row per player per league, with
-- who granted it and when. Revoking is a timestamp, never a delete — we need
-- to be able to answer "was this on file when that film was processed?".

create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  source text not null default 'school_form'
    check (source in ('school_form', 'guardian_email', 'athlete_signed')),
  note text not null default '',
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, user_id)
);
create index if not exists consents_league_idx on public.consents (league_id);

create or replace function public.has_video_consent(p_league uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.consents
    where league_id = p_league and user_id = p_user and revoked_at is null
  )
$$;

-- --------------------------------------------------------------- recordings
-- league_id is NOT stored: it is derived through league_of_game(), the same
-- way game_events and lineup_states scope themselves. One source of truth.

create table if not exists public.recordings (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  uploaded_by uuid references auth.users (id) on delete set null,
  storage_path text,
  duration_s int,
  fps numeric,
  width int,
  height int,
  size_bytes bigint,
  camera_note text not null default '',
  -- Sprint plan shortcut: the admin drags one box around the rim instead of
  -- tracking the ball across the floor. {x, y, w, h} in 0..1 of frame size,
  -- so it survives a transcode to a different resolution.
  rim_roi jsonb,
  -- Full plan: four court corners tapped at setup -> server-side homography.
  -- Unused in v1; the column exists so M3 needs no migration.
  court_corners jsonb,
  court_side text not null default 'full' check (court_side in ('full', 'left', 'right')),
  status text not null default 'uploading'
    check (status in ('uploading', 'queued', 'processing', 'review', 'complete', 'failed')),
  -- Flipped only by the consent trigger below. Never set it by hand.
  consent_verified boolean not null default false,
  error text,
  -- Retention clock (§7). Raw film is biometric-adjacent; derived stats are
  -- not, and outlive it.
  delete_after timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists recordings_game_idx on public.recordings (game_id);
create index if not exists recordings_status_idx on public.recordings (status);

-- -------------------------------------------------------------- vision jobs
-- One row per pipeline run. Drives the progress bar and the cost dashboard.

create table if not exists public.vision_jobs (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.recordings (id) on delete cascade,
  stage text not null default 'queued'
    check (stage in ('queued', 'decode', 'detect', 'classify', 'emit', 'done')),
  progress numeric not null default 0 check (progress between 0 and 1),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed')),
  model_version text not null default 'unknown',
  gpu_seconds numeric,
  cost_cents numeric,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vision_jobs_recording_idx on public.vision_jobs (recording_id, created_at desc);

-- ----------------------------------------------------------- detected events
-- Candidates. `status` starts 'pending'; the review room moves it. Confirming
-- inserts a real game_events row and links it back through promoted_event_id.

create table if not exists public.detected_events (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.recordings (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  -- game_events vocabulary; see the note at the top of this file.
  type text not null check (type in (
    'fg2_made', 'fg2_miss', 'fg3_made', 'fg3_miss', 'ft_made', 'ft_miss',
    'oreb', 'dreb', 'ast', 'stl', 'blk', 'to', 'pf', 'tf'
  )),
  ts_ms int not null check (ts_ms >= 0),
  frame int,
  period smallint not null default 1,
  -- The shooter. Null until the reviewer tags one — v1 has no player identity
  -- model. Exactly the same one-of shape as game_events.
  user_id uuid references auth.users (id) on delete set null,
  guest_id uuid references public.game_guests (id) on delete set null,
  team_id uuid references public.teams (id) on delete set null,
  -- 0..1. Sort the review queue ascending: shakiest calls get human eyes first.
  confidence numeric not null check (confidence between 0 and 1),
  model_version text not null default 'unknown',
  -- Free-form pipeline detail: rim crop path, motion energy, ball track.
  payload jsonb not null default '{}'::jsonb,
  source text not null default 'model' check (source in ('model', 'manual')),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'rejected')),
  -- True when the reviewer changed the type or the shooter before confirming.
  -- These rows are the training signal (build plan §5 M4).
  edited boolean not null default false,
  promoted_event_id uuid references public.game_events (id) on delete set null,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint detected_events_one_player check (user_id is null or guest_id is null)
);
create index if not exists detected_events_recording_idx
  on public.detected_events (recording_id, ts_ms);
create index if not exists detected_events_queue_idx
  on public.detected_events (recording_id, status, confidence);

-- ------------------------------------------------------------------ triggers

drop trigger if exists consents_updated_at on public.consents;
create trigger consents_updated_at before update on public.consents
  for each row execute function public.set_updated_at();
drop trigger if exists recordings_updated_at on public.recordings;
create trigger recordings_updated_at before update on public.recordings
  for each row execute function public.set_updated_at();
drop trigger if exists vision_jobs_updated_at on public.vision_jobs;
create trigger vision_jobs_updated_at before update on public.vision_jobs
  for each row execute function public.set_updated_at();
drop trigger if exists detected_events_updated_at on public.detected_events;
create trigger detected_events_updated_at before update on public.detected_events
  for each row execute function public.set_updated_at();

create or replace function public.league_of_recording(p_recording uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select public.league_of_game(r.game_id) from public.recordings r where r.id = p_recording
$$;

-- --------------------------------------------------------------- the gate
-- Every rostered player on both teams needs an unrevoked consent row before
-- film can be processed. Guests (free-text pickup players) have no account to
-- consent with, so they are never identified — see the note in emit/review.
-- Returns the names that are missing so the error can name the fix.

create or replace function public.missing_consents(p_recording uuid)
returns table (user_id uuid, full_name text)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name
  from public.recordings r
  join public.games g on g.id = r.game_id
  join public.team_members tm
    on tm.team_id in (g.home_team_id, g.away_team_id)
   and tm.left_at is null
  join public.profiles p on p.id = tm.user_id
  where r.id = p_recording
    and not public.has_video_consent(public.league_of_game(g.id), tm.user_id)
  order by p.full_name
$$;

create or replace function public.assert_recording_consent(p_recording uuid)
returns void language plpgsql stable security definer set search_path = public as $$
declare
  v_names text;
  v_count int;
begin
  select count(*), string_agg(full_name, ', ' order by full_name)
    into v_count, v_names
  from public.missing_consents(p_recording);

  if v_count > 0 then
    raise exception
      'Video consent is missing for % player(s): %. Record consent on the Film page before processing.',
      v_count, v_names;
  end if;
end $$;

-- Blocks the transition into 'queued' — the moment film becomes an input to a
-- model. Uploading is allowed without consent so the file can be deleted
-- again; processing is not.
create or replace function public.recordings_consent_gate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'queued' and coalesce(old.status, '') <> 'queued' then
    perform public.assert_recording_consent(new.id);
    new.consent_verified := true;
  end if;
  return new;
end $$;

drop trigger if exists recordings_consent_gate on public.recordings;
create trigger recordings_consent_gate before update on public.recordings
  for each row execute function public.recordings_consent_gate();

-- ---------------------------------------------------------------- retention
-- Opportunistic, like purge_expired_leagues() in 0012 — there is no pg_cron
-- on the free tier and the exact hour does not matter, only that expired film
-- eventually goes away. Derived stats (detected_events, game_events) survive:
-- they hold no biometric data.

create or replace function public.purge_expired_recordings()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_count int := 0;
  v_paths text[];
begin
  select coalesce(array_agg(storage_path), '{}')
    into v_paths
  from public.recordings
  where delete_after < now() and storage_path is not null;

  if array_length(v_paths, 1) is not null
     and exists (select 1 from pg_namespace where nspname = 'storage') then
    execute 'delete from storage.objects where bucket_id = ''film'' and name = any($1)'
      using v_paths;
  end if;

  update public.recordings
     set storage_path = null,
         status = case when status in ('uploading', 'queued', 'processing')
                       then 'failed' else status end,
         error = case when status in ('uploading', 'queued', 'processing')
                      then 'Film was deleted by the 30-day retention policy before processing finished.'
                      else error end
   where delete_after < now() and storage_path is not null;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke execute on function public.purge_expired_recordings from public, anon;
grant execute on function public.purge_expired_recordings to authenticated;

-- --------------------------------------------------------------------- RLS
-- Film is admin-only, full stop (§7 "default private"). Players never read
-- recordings, jobs, or candidates — they see the confirmed game_events, which
-- the existing "events: members read" policy already covers.

alter table public.consents enable row level security;
alter table public.recordings enable row level security;
alter table public.vision_jobs enable row level security;
alter table public.detected_events enable row level security;

-- A player can see their own consent state — "is my film consent on file?" is
-- a question they are entitled to ask. Only admins can grant or revoke.
drop policy if exists "consents: own or admin read" on public.consents;
create policy "consents: own or admin read" on public.consents for select to authenticated
  using (user_id = auth.uid() or public.is_league_admin(league_id));
drop policy if exists "consents: admins write" on public.consents;
create policy "consents: admins write" on public.consents for all to authenticated
  using (public.is_league_admin(league_id))
  with check (public.is_league_admin(league_id));

drop policy if exists "recordings: admins only" on public.recordings;
create policy "recordings: admins only" on public.recordings for all to authenticated
  using (public.is_league_admin(public.league_of_game(game_id)))
  with check (public.is_league_admin(public.league_of_game(game_id)));

drop policy if exists "vision jobs: admins read" on public.vision_jobs;
create policy "vision jobs: admins read" on public.vision_jobs for select to authenticated
  using (public.is_league_admin(public.league_of_recording(recording_id)));

drop policy if exists "detected: admins only" on public.detected_events;
create policy "detected: admins only" on public.detected_events for all to authenticated
  using (public.is_league_admin(public.league_of_game(game_id)))
  with check (
    public.is_league_admin(public.league_of_game(game_id))
    -- Promotion runs through confirm_detected_event(); a direct client
    -- UPDATE cannot forge a confirmed row that points at a game_event.
    and status = 'pending'
    and promoted_event_id is null
  );

-- ---------------------------------------------------------------- worker API
-- The Modal worker authenticates with the service role, where auth.uid() is
-- null. These two functions are the entire surface it needs; it never touches
-- a table directly.

create or replace function public.vision_worker_may_write(p_recording uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is null
      or public.is_league_admin(public.league_of_recording(p_recording))
$$;

create or replace function public.set_vision_progress(
  p_recording uuid,
  p_stage text,
  p_progress numeric,
  p_status text default 'running',
  p_model_version text default 'unknown',
  p_error text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_job uuid;
begin
  if not public.vision_worker_may_write(p_recording) then
    raise exception 'Not allowed to write progress for this recording';
  end if;

  select id into v_job from vision_jobs
  where recording_id = p_recording order by created_at desc limit 1;

  if v_job is null then
    insert into vision_jobs (recording_id, stage, progress, status, model_version, started_at)
    values (p_recording, p_stage, p_progress, p_status, p_model_version, now())
    returning id into v_job;
  else
    update vision_jobs
       set stage = p_stage,
           progress = p_progress,
           status = p_status,
           model_version = p_model_version,
           error = p_error,
           finished_at = case when p_status in ('succeeded', 'failed') then now() else finished_at end
     where id = v_job;
  end if;

  update recordings
     set status = case
           when p_status = 'failed' then 'failed'
           when p_stage = 'done' then 'review'
           else 'processing' end,
         error = p_error
   where id = p_recording;

  return v_job;
end $$;

-- Bulk insert of candidates. Idempotent per (recording, type, ts_ms): a
-- retried job replaces its own output instead of doubling the review queue.
-- Rows already reviewed by a human are never overwritten.
create or replace function public.ingest_detected_events(
  p_recording uuid,
  p_model_version text,
  p_events jsonb
) returns int language plpgsql security definer set search_path = public as $$
declare
  v_game uuid;
  v_count int;
begin
  if not public.vision_worker_may_write(p_recording) then
    raise exception 'Not allowed to write events for this recording';
  end if;
  if jsonb_typeof(p_events) <> 'array' then
    raise exception 'p_events must be a JSON array of {type, ts_ms, confidence}';
  end if;

  select game_id into v_game from recordings where id = p_recording;
  if v_game is null then
    raise exception 'No such recording';
  end if;

  delete from detected_events
   where recording_id = p_recording and source = 'model' and status = 'pending';

  insert into detected_events
    (recording_id, game_id, type, ts_ms, frame, period, confidence, model_version, payload)
  select
    p_recording,
    v_game,
    e ->> 'type',
    (e ->> 'ts_ms')::int,
    nullif(e ->> 'frame', '')::int,
    coalesce(nullif(e ->> 'period', '')::smallint, 1),
    least(1, greatest(0, (e ->> 'confidence')::numeric)),
    p_model_version,
    coalesce(e -> 'payload', '{}'::jsonb)
  from jsonb_array_elements(p_events) as e
  -- a re-run must not duplicate a candidate a human already ruled on
  where not exists (
    select 1 from detected_events d
    where d.recording_id = p_recording
      and d.status <> 'pending'
      and d.type = e ->> 'type'
      and abs(d.ts_ms - (e ->> 'ts_ms')::int) < 1500
  );
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ---------------------------------------------------------------- review API
-- Confirming has to be a SECURITY DEFINER RPC, not a client insert: the
-- game_events insert policy requires games.status = 'live', and film is
-- reviewed after the final whistle.
--
-- The detected_event's own id is reused as the game_event's client_uuid, so
-- the unique (game_id, client_uuid) index makes a double-confirm a no-op and
-- gives un-confirm an exact row to find.

create or replace function public.confirm_detected_event(
  p_id uuid,
  p_type text default null,
  p_user uuid default null,
  p_guest uuid default null,
  p_team uuid default null,
  p_period smallint default null,
  p_related_user uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  d record;
  v_type text;
  v_period smallint;
  v_seq int;
  v_event uuid;
  v_points smallint;
begin
  select * into d from detected_events where id = p_id;
  if d is null then raise exception 'No such detected event'; end if;
  if not public.is_league_admin(public.league_of_game(d.game_id)) then
    raise exception 'Only league admins can confirm film events';
  end if;
  if p_user is not null and p_guest is not null then
    raise exception 'An event belongs to one player, not two';
  end if;

  v_type := coalesce(p_type, d.type);
  v_period := coalesce(p_period, d.period);
  v_points := case v_type
    when 'fg2_made' then 2 when 'fg3_made' then 3 when 'ft_made' then 1 end;

  if d.promoted_event_id is not null then
    -- already promoted: re-confirming applies the edit in place
    update game_events
       set type = v_type,
           value = v_points,
           period = v_period,
           user_id = p_user,
           guest_id = p_guest,
           team_id = coalesce(p_team, d.team_id),
           related_user_id = p_related_user,
           voided = false
     where id = d.promoted_event_id;
    v_event := d.promoted_event_id;
  else
    select coalesce(max(seq), 0) + 1 into v_seq from game_events where game_id = d.game_id;
    insert into game_events
      (game_id, seq, period, clock_ms, team_id, user_id, guest_id, type, value,
       related_user_id, created_by, client_uuid)
    values
      (d.game_id, v_seq, v_period, null, coalesce(p_team, d.team_id), p_user, p_guest,
       v_type, v_points, p_related_user, auth.uid(), d.id)
    on conflict (game_id, client_uuid) do update
      set type = excluded.type, value = excluded.value, voided = false
    returning id into v_event;
  end if;

  update detected_events
     set status = 'confirmed',
         type = v_type,
         period = v_period,
         user_id = p_user,
         guest_id = p_guest,
         team_id = coalesce(p_team, d.team_id),
         edited = edited
           or v_type <> d.type
           or p_user is distinct from d.user_id
           or p_guest is distinct from d.guest_id,
         promoted_event_id = v_event,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_id;

  return v_event;
end $$;

-- Rejecting a promoted candidate voids its game_event rather than deleting
-- it: game_events is an append-only ledger everywhere else in the app, and
-- computeBoxScore() already skips voided rows.
create or replace function public.reject_detected_event(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  d record;
begin
  select * into d from detected_events where id = p_id;
  if d is null then raise exception 'No such detected event'; end if;
  if not public.is_league_admin(public.league_of_game(d.game_id)) then
    raise exception 'Only league admins can review film events';
  end if;

  if d.promoted_event_id is not null then
    update game_events set voided = true where id = d.promoted_event_id;
  end if;

  update detected_events
     set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id;
end $$;

-- Back to the queue, for a misclick.
create or replace function public.unreview_detected_event(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  d record;
begin
  select * into d from detected_events where id = p_id;
  if d is null then raise exception 'No such detected event'; end if;
  if not public.is_league_admin(public.league_of_game(d.game_id)) then
    raise exception 'Only league admins can review film events';
  end if;

  if d.promoted_event_id is not null then
    update game_events set voided = true where id = d.promoted_event_id;
  end if;

  update detected_events
     set status = 'pending', reviewed_by = null, reviewed_at = null
   where id = p_id;
end $$;

revoke execute on function public.set_vision_progress from public, anon;
revoke execute on function public.ingest_detected_events from public, anon;
revoke execute on function public.confirm_detected_event from public, anon;
revoke execute on function public.reject_detected_event from public, anon;
revoke execute on function public.unreview_detected_event from public, anon;
revoke execute on function public.assert_recording_consent from public, anon;
revoke execute on function public.missing_consents from public, anon;
grant execute on function public.set_vision_progress to authenticated;
grant execute on function public.ingest_detected_events to authenticated;
grant execute on function public.confirm_detected_event to authenticated;
grant execute on function public.reject_detected_event to authenticated;
grant execute on function public.unreview_detected_event to authenticated;
grant execute on function public.assert_recording_consent to authenticated;
grant execute on function public.missing_consents to authenticated;

-- The worker signs in as service_role. Guarded: plain Postgres (the PGlite
-- harness) has no such role, and this migration must still apply there.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.set_vision_progress to service_role';
    execute 'grant execute on function public.ingest_detected_events to service_role';
  end if;
end $$;

-- ------------------------------------------------------------------ realtime
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.vision_jobs;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.detected_events;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

-- ------------------------------------------------------------------- storage
-- Private bucket "film". Paths are "<league_id>/<recording_id>.<ext>" so the
-- policies scope by league exactly like the rules bucket in 0007. Guarded so
-- this migration still applies to plain Postgres (the PGlite harness has no
-- storage schema).

do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit)
  values ('film', 'film', false, 6442450944)  -- 6 GB: a 40-minute 1080p60 game
  on conflict (id) do nothing;

  begin
    execute $pol$
      create policy "film bucket: admins read" on storage.objects
      for select to authenticated
      using (
        bucket_id = 'film'
        and public.is_league_admin(((storage.foldername(name))[1])::uuid)
      )
    $pol$;
    execute $pol$
      create policy "film bucket: admins insert" on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'film'
        and public.is_league_admin(((storage.foldername(name))[1])::uuid)
      )
    $pol$;
    execute $pol$
      create policy "film bucket: admins delete" on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'film'
        and public.is_league_admin(((storage.foldername(name))[1])::uuid)
      )
    $pol$;
  exception
    when insufficient_privilege then
      raise notice 'Could not create storage.objects policies — add them in the Supabase dashboard (Storage → film → Policies).';
    when duplicate_object then
      null; -- re-run
  end;
end $$;
