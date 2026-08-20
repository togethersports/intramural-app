-- Push, for the things the watch cannot work out on its own.
--
-- The three tip-off notices do not need this and deliberately do not use it:
-- the watch schedules those locally from cached fixtures, so they fire in a
-- basement gym with no signal. A push would not arrive there, which is
-- exactly where the notice matters most.
--
-- What needs a server is everything the *server* learns: a captain approving
-- a sub, a teammate flagging out, a poll locking. The watch was polling for
-- those on background refresh, which watchOS grants on its own schedule —
-- within the hour, not within the minute. This is what closes that gap.

-- ---------------------------------------------------------------- devices

create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Hex APNs device token. Unique because Apple reissues the same token to
  -- the same install; re-registering must move it to the current user
  -- rather than accumulate a row per sign-in. One watch, one row.
  token text not null unique,
  platform text not null default 'watchos'
    check (platform in ('watchos', 'ios')),
  -- The topic APNs needs. The watch app's id differs from the phone's, so
  -- one column cannot be assumed from the other.
  bundle_id text not null,
  -- Apple's feedback comes as a 410 on send; when that happens the row is
  -- retired rather than deleted, so a device that comes back can be told
  -- apart from one that was never seen.
  invalidated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists device_tokens_user_idx
  on public.device_tokens (user_id) where invalidated_at is null;

alter table public.device_tokens enable row level security;

-- A device token is personal: you may register and retire your own, and see
-- nobody else's. The cron reads across everyone through the service role,
-- which bypasses RLS by design — it has no session to borrow.
drop policy if exists "devices: own read" on public.device_tokens;
create policy "devices: own read" on public.device_tokens for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "devices: own write" on public.device_tokens;
create policy "devices: own write" on public.device_tokens for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop trigger if exists device_tokens_updated_at on public.device_tokens;
create trigger device_tokens_updated_at before update on public.device_tokens
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------- new channel

-- reminder_log is what makes sending idempotent: every (game, player, kind,
-- channel) is claimed before the message goes out, and the unique index
-- settles the race. Push joins that scheme rather than inventing its own, so
-- two overlapping cron runs cannot double-buzz a wrist.
alter table public.reminder_log drop constraint if exists reminder_log_channel_check;
alter table public.reminder_log add constraint reminder_log_channel_check
  check (channel in ('email', 'sms', 'push'));

notify pgrst, 'reload schema';
