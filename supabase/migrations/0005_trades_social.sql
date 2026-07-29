-- Trades (with approval flow), playoff brackets, league feed, awards,
-- notification preferences, push subscriptions, audit log.

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  from_team_id uuid not null references public.teams (id) on delete cascade,
  to_team_id uuid not null references public.teams (id) on delete cascade,
  status text not null default 'proposed'
    check (status in ('proposed', 'accepted', 'declined', 'cancelled', 'executed', 'vetoed')),
  proposed_by uuid not null references auth.users (id) on delete cascade,
  resolved_by uuid references auth.users (id) on delete set null,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_team_id <> to_team_id)
);
create index trades_season_idx on public.trades (season_id, status);

create table public.trade_items (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  from_team_id uuid not null references public.teams (id) on delete cascade,
  to_team_id uuid not null references public.teams (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trade_id, user_id)
);

create table public.trade_votes (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  vote boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trade_id, user_id)
);

create table public.bracket_nodes (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  round smallint not null,
  position smallint not null,
  home_source text not null default '', -- 'seed:1' | 'winner:<node uuid>'
  away_source text not null default '',
  game_id uuid references public.games (id) on delete set null,
  winner_team_id uuid references public.teams (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, round, position)
);

alter table public.games
  add constraint games_bracket_node_fk
  foreign key (bracket_node_id) references public.bracket_nodes (id) on delete set null;

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  season_id uuid references public.seasons (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  team_id uuid references public.teams (id) on delete cascade,
  kind text not null default 'announcement'
    check (kind in ('announcement', 'auto', 'team')),
  body text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index posts_league_idx on public.posts (league_id, created_at desc);

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, user_id, emoji)
);

create table public.awards (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  kind text not null,
  user_id uuid references auth.users (id) on delete cascade,
  team_id uuid references public.teams (id) on delete cascade,
  week smallint,
  is_auto boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notification_prefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null,
  enabled boolean not null default true,
  lead_minutes smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category)
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text not null default '',
  target_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index audit_log_league_idx on public.audit_log (league_id, created_at desc);

create trigger trades_updated_at before update on public.trades
  for each row execute function public.set_updated_at();
create trigger trade_items_updated_at before update on public.trade_items
  for each row execute function public.set_updated_at();
create trigger trade_votes_updated_at before update on public.trade_votes
  for each row execute function public.set_updated_at();
create trigger bracket_nodes_updated_at before update on public.bracket_nodes
  for each row execute function public.set_updated_at();
create trigger posts_updated_at before update on public.posts
  for each row execute function public.set_updated_at();
create trigger reactions_updated_at before update on public.reactions
  for each row execute function public.set_updated_at();
create trigger awards_updated_at before update on public.awards
  for each row execute function public.set_updated_at();
create trigger push_subscriptions_updated_at before update on public.push_subscriptions
  for each row execute function public.set_updated_at();
create trigger notification_prefs_updated_at before update on public.notification_prefs
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------- RLS

alter table public.trades enable row level security;
alter table public.trade_items enable row level security;
alter table public.trade_votes enable row level security;
alter table public.bracket_nodes enable row level security;
alter table public.posts enable row level security;
alter table public.reactions enable row level security;
alter table public.awards enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.audit_log enable row level security;

create policy "trades: members read" on public.trades for select to authenticated
  using (public.league_role(public.league_of_season(season_id)) is not null);
-- writes go through RPCs (security definer)

create policy "trade items: members read" on public.trade_items for select to authenticated
  using (exists (
    select 1 from public.trades t where t.id = trade_id
      and public.league_role(public.league_of_season(t.season_id)) is not null
  ));

create policy "trade votes: members" on public.trade_votes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "trade votes: members read" on public.trade_votes for select to authenticated
  using (exists (
    select 1 from public.trades t where t.id = trade_id
      and public.league_role(public.league_of_season(t.season_id)) is not null
  ));

create policy "brackets: members read" on public.bracket_nodes for select to authenticated
  using (public.league_role(public.league_of_season(season_id)) is not null);
create policy "brackets: admins write" on public.bracket_nodes for all to authenticated
  using (public.is_league_admin(public.league_of_season(season_id)))
  with check (public.is_league_admin(public.league_of_season(season_id)));

create policy "posts: members read" on public.posts for select to authenticated
  using (public.league_role(league_id) is not null);
create policy "posts: admins announce" on public.posts for insert to authenticated
  with check (
    author_id = auth.uid()
    and (
      (kind = 'announcement' and public.is_league_admin(league_id))
      or (kind = 'team' and exists (
        select 1 from public.teams t where t.id = team_id and t.captain_id = auth.uid()
      ))
    )
  );
create policy "posts: admins delete" on public.posts for delete to authenticated
  using (public.is_league_admin(league_id) or author_id = auth.uid());

create policy "reactions: members" on public.reactions for all to authenticated
  using (user_id = auth.uid()) with check (
    user_id = auth.uid() and exists (
      select 1 from public.posts p where p.id = post_id
        and public.league_role(p.league_id) is not null
    )
  );
create policy "reactions: members read" on public.reactions for select to authenticated
  using (exists (
    select 1 from public.posts p where p.id = post_id
      and public.league_role(p.league_id) is not null
  ));

create policy "awards: members read" on public.awards for select to authenticated
  using (public.league_role(public.league_of_season(season_id)) is not null);
create policy "awards: admins write" on public.awards for all to authenticated
  using (public.is_league_admin(public.league_of_season(season_id)))
  with check (public.is_league_admin(public.league_of_season(season_id)));

create policy "push subs: own" on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "notif prefs: own" on public.notification_prefs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "audit: admins read" on public.audit_log for select to authenticated
  using (public.is_league_admin(league_id));
create policy "audit: admins insert" on public.audit_log for insert to authenticated
  with check (public.is_league_admin(league_id) or actor_id = auth.uid());

-- ---------------------------------------------------------------------- RPCs

-- Auto-generated feed posts (finals, trades) — membership required.
create or replace function public.post_auto(
  p_league uuid, p_season uuid, p_body text, p_meta jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  if league_role(p_league) is null then
    raise exception 'Not a member of this league';
  end if;
  insert into posts (league_id, season_id, author_id, kind, body, meta)
  values (p_league, p_season, auth.uid(), 'auto', p_body, p_meta);
end $$;

create or replace function public.notify_team(
  p_team uuid, p_category text, p_title text, p_body text, p_link text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_league uuid := league_of_team(p_team);
begin
  if league_role(v_league) is null then
    raise exception 'Not a member of this league';
  end if;
  insert into notifications (user_id, league_id, category, title, body, link)
  select tm.user_id, v_league, p_category, p_title, p_body, p_link
  from team_members tm where tm.team_id = p_team and tm.left_at is null;
end $$;

-- Captain of from_team proposes; offer/request are player uuid arrays.
create or replace function public.propose_trade(
  p_season uuid, p_from_team uuid, p_to_team uuid,
  p_offer uuid[], p_request uuid[], p_note text default ''
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_trade uuid;
  v_user uuid;
  v_captain uuid;
begin
  if not exists (
    select 1 from teams t where t.id = p_from_team
      and t.season_id = p_season and t.captain_id = auth.uid()
  ) and not is_league_admin(league_of_season(p_season)) then
    raise exception 'Only the team captain can propose a trade';
  end if;
  if array_length(p_offer, 1) is null or array_length(p_request, 1) is null then
    raise exception 'A trade needs players on both sides';
  end if;

  -- every offered/requested player must be an active member of their side
  foreach v_user in array p_offer loop
    if not exists (select 1 from team_members tm where tm.team_id = p_from_team
                   and tm.user_id = v_user and tm.left_at is null) then
      raise exception 'Offered player is not on your roster';
    end if;
  end loop;
  foreach v_user in array p_request loop
    if not exists (select 1 from team_members tm where tm.team_id = p_to_team
                   and tm.user_id = v_user and tm.left_at is null) then
      raise exception 'Requested player is not on the other roster';
    end if;
  end loop;

  insert into trades (season_id, from_team_id, to_team_id, proposed_by, note)
  values (p_season, p_from_team, p_to_team, auth.uid(), coalesce(p_note, ''))
  returning id into v_trade;

  insert into trade_items (trade_id, user_id, from_team_id, to_team_id)
  select v_trade, u, p_from_team, p_to_team from unnest(p_offer) as u;
  insert into trade_items (trade_id, user_id, from_team_id, to_team_id)
  select v_trade, u, p_to_team, p_from_team from unnest(p_request) as u;

  select captain_id into v_captain from teams where id = p_to_team;
  if v_captain is not null then
    insert into notifications (user_id, league_id, category, title, body)
    values (v_captain, league_of_season(p_season), 'trade',
            'Trade offer received', 'A trade proposal is waiting for your answer.');
  end if;
  return v_trade;
end $$;

-- Moves every item's player, closing the old roster stint.
create or replace function public.execute_trade_internal(p_trade uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v trades;
  v_item record;
  v_min int;
  v_max int;
  v_size int;
  v_team uuid;
begin
  select * into v from trades where id = p_trade for update;

  for v_item in select * from trade_items where trade_id = p_trade loop
    if not exists (select 1 from team_members tm where tm.team_id = v_item.from_team_id
                   and tm.user_id = v_item.user_id and tm.left_at is null) then
      raise exception 'A player in this trade is no longer on the expected roster';
    end if;
  end loop;

  select coalesce((rules ->> 'roster_min')::int, 0),
         coalesce((rules ->> 'roster_max')::int, 99)
  into v_min, v_max
  from seasons where id = v.season_id;

  -- apply moves
  update team_members tm set left_at = now()
  from trade_items it
  where it.trade_id = p_trade and tm.team_id = it.from_team_id
    and tm.user_id = it.user_id and tm.left_at is null;

  insert into team_members (team_id, user_id)
  select it.to_team_id, it.user_id from trade_items it where it.trade_id = p_trade;

  -- roster size validation post-trade
  foreach v_team in array (array[v.from_team_id, v.to_team_id]) loop
    select count(*) into v_size from team_members
    where team_id = v_team and left_at is null;
    if v_size < v_min or v_size > v_max then
      raise exception 'Trade would leave a roster outside the % – % size limits', v_min, v_max;
    end if;
  end loop;

  -- a traded captain stays a league captain but is not captain of the new team
  update team_members tm set is_captain = false
  from trade_items it
  where it.trade_id = p_trade and tm.team_id = it.to_team_id
    and tm.user_id = it.user_id and tm.left_at is null;

  -- edge case (BRIEF §8): a captain who gets traded no longer captains the
  -- team they left — the commissioner appoints a replacement.
  update teams t set captain_id = null
  where t.id in (v.from_team_id, v.to_team_id)
    and exists (
      select 1 from trade_items it
      where it.trade_id = p_trade and it.user_id = t.captain_id
        and it.from_team_id = t.id
    );

  update trades set status = 'executed', resolved_by = auth.uid() where id = p_trade;

  perform notify_team(v.from_team_id, 'trade', 'Trade executed',
    'Your trade has been approved and executed.');
  perform notify_team(v.to_team_id, 'trade', 'Trade executed',
    'Your trade has been approved and executed.');
  -- Voice: name the teams and the players, no decoration (brandbook 07).
  perform post_auto(league_of_season(v.season_id), v.season_id,
    'TRADE: ' || (select name from teams where id = v.from_team_id)
      || ' send ' || (select string_agg(p.full_name, ', ')
                  from trade_items it join profiles p on p.id = it.user_id
                  where it.trade_id = p_trade and it.from_team_id = v.from_team_id)
      || ' to ' || (select name from teams where id = v.to_team_id)
      || ' for ' || (select string_agg(p.full_name, ', ')
                  from trade_items it join profiles p on p.id = it.user_id
                  where it.trade_id = p_trade and it.from_team_id = v.to_team_id)
      || '.',
    jsonb_build_object('trade_id', p_trade));

  insert into audit_log (league_id, actor_id, action, target_type, target_id)
  values (league_of_season(v.season_id), auth.uid(), 'trade_executed', 'trade', p_trade);
end $$;

-- Counterparty captain answers. Auto-approve leagues execute immediately.
create or replace function public.respond_trade(p_trade uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v trades;
  v_auto boolean;
begin
  select * into v from trades where id = p_trade for update;
  if v.status <> 'proposed' then raise exception 'Trade is no longer open'; end if;
  if not exists (select 1 from teams t where t.id = v.to_team_id and t.captain_id = auth.uid()) then
    raise exception 'Only the receiving captain can respond';
  end if;

  if not p_accept then
    update trades set status = 'declined', resolved_by = auth.uid() where id = p_trade;
    perform notify_team(v.from_team_id, 'trade', 'Trade declined',
      'Your trade proposal was declined.');
    return;
  end if;

  update trades set status = 'accepted' where id = p_trade;
  select coalesce(settings ->> 'trade_approval', 'commissioner') = 'auto'
  into v_auto from leagues where id = league_of_season(v.season_id);
  if v_auto then
    perform execute_trade_internal(p_trade);
  else
    perform notify_team(v.from_team_id, 'trade', 'Trade accepted',
      'Waiting on commissioner approval.');
  end if;
end $$;

-- Commissioner approves (executes) or vetoes an accepted trade.
create or replace function public.resolve_trade(p_trade uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v trades;
begin
  select * into v from trades where id = p_trade for update;
  if not is_league_admin(league_of_season(v.season_id)) then
    raise exception 'Only league admins can resolve trades';
  end if;
  if v.status not in ('proposed', 'accepted') then
    raise exception 'Trade is not awaiting a decision';
  end if;
  if p_approve then
    if v.status <> 'accepted' then
      raise exception 'The receiving captain has not accepted yet';
    end if;
    perform execute_trade_internal(p_trade);
  else
    update trades set status = 'vetoed', resolved_by = auth.uid() where id = p_trade;
    perform notify_team(v.from_team_id, 'trade', 'Trade vetoed',
      'The commissioner vetoed the trade.');
    perform notify_team(v.to_team_id, 'trade', 'Trade vetoed',
      'The commissioner vetoed the trade.');
  end if;
end $$;

-- Proposer can withdraw an open proposal.
create or replace function public.cancel_trade(p_trade uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v trades;
begin
  select * into v from trades where id = p_trade for update;
  if v.proposed_by <> auth.uid() and not is_league_admin(league_of_season(v.season_id)) then
    raise exception 'Only the proposer can cancel';
  end if;
  if v.status not in ('proposed', 'accepted') then
    raise exception 'Trade can no longer be cancelled';
  end if;
  update trades set status = 'cancelled', resolved_by = auth.uid() where id = p_trade;
end $$;

revoke execute on function
  public.execute_trade_internal, public.propose_trade, public.respond_trade,
  public.resolve_trade, public.cancel_trade, public.post_auto, public.notify_team
from public, anon;
grant execute on function
  public.propose_trade, public.respond_trade, public.resolve_trade,
  public.cancel_trade, public.post_auto, public.notify_team
to authenticated;
