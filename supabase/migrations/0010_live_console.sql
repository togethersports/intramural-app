-- Live console: finalizing a game locks its box score.
--
-- Before this, the assigned scorekeeper could void/edit events and reopen
-- the games row forever. Now: event edits are allowed only while the game
-- is live; league admins keep post-final edit rights for stat disputes
-- (BRIEF §3.6). Idempotent — safe to run twice.

drop policy if exists "events: scorekeeper voids" on public.game_events;
create policy "events: scorekeeper voids" on public.game_events for update to authenticated
  using (
    public.can_score_game(game_id)
    and (
      exists (select 1 from public.games g where g.id = game_id and g.status = 'live')
      or public.is_league_admin(public.league_of_game(game_id))
    )
  )
  with check (
    public.can_score_game(game_id)
    and (
      exists (select 1 from public.games g where g.id = game_id and g.status = 'live')
      or public.is_league_admin(public.league_of_game(game_id))
    )
  );

-- A scorekeeper can run the game up to and including setting it final, but
-- cannot touch a game that is already final (admins still can, via the
-- separate admin policy).
drop policy if exists "games: scorekeeper updates" on public.games;
create policy "games: scorekeeper updates" on public.games for update to authenticated
  using (scorekeeper_id = auth.uid() and status <> 'final')
  with check (scorekeeper_id = auth.uid());
