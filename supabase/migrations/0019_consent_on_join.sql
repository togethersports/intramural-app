-- Vision V1: consent at join, and the gate re-checked where data lands.
--
-- League policy change: film consent is part of joining the league — the
-- school collects it on the league signup form, so the app records it the
-- moment a membership goes active. The gate flips from "block until granted"
-- to "open unless revoked". Revoking still closes it for real (§7): one
-- revoked player on either roster and the film cannot be processed.

alter table public.consents drop constraint if exists consents_source_check;
alter table public.consents add constraint consents_source_check
  check (source in ('school_form', 'guardian_email', 'athlete_signed', 'league_join'));

-- Fires on every path a member arrives by: the join-code RPC, create_league,
-- the demo seed, ghost players. ON CONFLICT DO NOTHING is what keeps
-- revocation real — re-joining or re-activating never resurrects a consent a
-- family withdrew.
create or replace function public.grant_consent_on_join()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'active' then
    insert into consents (league_id, user_id, granted_by, source, note)
    values (new.league_id, new.user_id, new.user_id, 'league_join',
            'Recorded automatically when the player joined the league')
    on conflict (league_id, user_id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists league_members_consent on public.league_members;
create trigger league_members_consent
  after insert or update of status on public.league_members
  for each row execute function public.grant_consent_on_join();

-- Everyone already in a league joined under the same signup form.
insert into public.consents (league_id, user_id, granted_by, source, note)
select league_id, user_id, user_id, 'league_join',
       'Recorded automatically when the player joined the league'
from public.league_members
where status = 'active'
on conflict (league_id, user_id) do nothing;

-- With consent implicit at join, "missing" now means "revoked" (or a roster
-- player who somehow never joined the league). Say that, and name the fix.
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
      'Film consent is missing or was revoked for % player(s): %. Re-grant it on the Film page before processing.',
      v_count, v_names;
  end if;
end $$;

-- Re-check the gate at the moment candidates land, not only at the queued
-- transition. The in-browser scanner reaches ingest without a worker in
-- between, and a revocation that arrives mid-run must stop the data, not
-- just the next queue attempt. (CREATE OR REPLACE keeps the 0018 grants.)
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
  perform public.assert_recording_consent(p_recording);
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
