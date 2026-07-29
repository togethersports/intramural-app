# Intramural: Web Build Prompt

Paste this whole document into Claude Code as the project brief. It's an instruction set, not a description. Web only, no native mobile app. Must be fully responsive and work well on a phone browser, since most player/captain usage happens on a phone between classes. Design and styling: use your own judgment, I'll provide visual inspiration separately.

---

## 1. WHAT YOU ARE BUILDING

A web app for running a school intramural sports league: captains draft teams, games are scheduled into lunch and free periods, stats and standings are tracked, there's a live game tracker for courtside scorekeeping, and playoffs at the end. Basketball first, but the data model should support other sports later.

One responsive Next.js app, two experience modes gated by role and viewport rather than separate apps:
- **Commissioner console:** dense, desktop-optimized. League setup, draft board, schedule builder, live stat tracking, admin tools.
- **Player/captain experience:** mobile-first. Next game, availability, stats, trades, notifications. Needs to feel fast on a phone browser.

Should be installable as a PWA (add to home screen) so it behaves app-like for players checking it between classes, and so the Live Game Tracker can work offline in a gym with bad Wi-Fi.

---

## 2. ROLES AND PERMISSIONS

| Capability | Commissioner | Co-Admin | Captain | Player | Spectator |
|---|:--:|:--:|:--:|:--:|:--:|
| Create/edit league settings | Yes | No | No | No | No |
| Invite/remove members | Yes | Yes | No | No | No |
| Run draft | Yes | Yes | Participates | View | View |
| Generate schedule | Yes | Yes | No | No | No |
| Edit any game score | Yes | Yes | No | No | No |
| Score a live game | Yes | Yes | Assignable | Assignable | No |
| Propose trade | Yes | Yes | Yes | No | No |
| Approve/veto trade | Yes | Yes | Counterparty only | No | No |
| Submit availability | Yes | Yes | Yes | Yes | No |
| View stats/standings | Yes | Yes | Yes | Yes | Yes |
| Post announcements | Yes | Yes | Team only | No | No |

Scorekeeper is a **per-game assignment**, not a global role. A commissioner can assign any member to keep book for a specific game, and that assignment unlocks the Live Game Tracker for them.

---

## 3. FEATURE SPECIFICATIONS

### 3.1 League and season setup
- Create a league: name, sport (basketball first, but schema must support soccer, volleyball, flag football, dodgeball), school/org, logo, color.
- Season: name, start date, end date, number of regular-season weeks, playoff format.
- **School schedule model:** commissioner defines named time slots (e.g. "Lunch A 11:40 to 12:10", "Free Period 6", "After School 3:30"). Games are scheduled into these slots, not raw timestamps. This is the core differentiator: normal league apps assume evenings and weekends.
- Venues: gyms, courts, half-courts. Each venue has a capacity of one concurrent game unless marked as splittable.
- Rule config: game length (quarters or halves, minutes), running vs stopped clock, foul limit, mercy rule, roster size min/max, points for win/loss/tie/forfeit.
- Join code and shareable invite link. Optional domain restriction (only `@school.org` emails).

### 3.2 Player pool and registration
- Players register, pick a jersey number, set position preference, upload avatar.
- Commissioner can bulk import via CSV (name, email, grade).
- Player profile: height (optional), grade, preferred positions, career stats across seasons.
- Commissioner marks players as draft-eligible, and designates captains.

### 3.3 The Draft (flagship feature)
Build this as a real-time room, not a form.
- Formats: snake, linear, or auction (auction can be phase 2).
- Configurable pick timer (default 60s) with auto-pick from queue, then best-available by a computed rating.
- Live room: current pick highlighted, on-the-clock banner, countdown ring, draft order rail, live team rosters filling in on the side.
- Captain tools: personal draft queue (drag to reorder), player search and filter, "do not draft" list, notes on a player. Fully usable from a phone browser.
- Commissioner tools: pause, undo last pick, force pick, edit order, reset draft.
- Everyone else gets a spectator view with a live pick ticker.
- Notification fires when a captain goes on the clock.
- Post-draft: draft recap page with a grade per team, best value pick, and full pick-by-pick log.

### 3.4 Availability (the scheduling engine input)
- Each player fills a weekly grid: day of week by defined time slot, marked Available / Maybe / Unavailable. Big tap targets, fast to fill out on a phone.
- Players can add date-specific overrides ("Out Nov 12, away game").
- Captains see a team heatmap: for each slot, how many players are available.
- Nudge button: captain or commissioner sends a notification to everyone who hasn't submitted availability.
- Availability decays: if not updated in N weeks, prompt the player to reconfirm.

### 3.5 Scheduling
Two modes, both desktop-optimized commissioner tools:

**Auto-generate.** Given N teams, W weeks, available slots, and venues, produce a schedule that:
1. Round-robin balances opponents (each team plays each other X times as evenly as possible).
2. Maximizes joint availability: score each candidate slot by `min(available_home, available_away)` and reject any slot where either team falls below the configured minimum (default 4 for 5v5).
3. Respects venue conflicts (one game per venue per slot).
4. Balances slot equity: no team gets stuck with the same undesirable period every week.
5. Enforces max games per team per week and minimum rest between games.

Implement as a greedy assignment over a scored candidate list, with a backtracking pass to fix unassigned matchups. Output includes a **conflict report**: matchups it could not place and why.

**Manual.** Drag-and-drop week builder. Grid of slots by venue, drag a matchup into a cell. Live conflict warnings ("3 Warriors players unavailable", "Gym B already booked").

Reschedule flow: commissioner moves a game, all affected players get notified, and the schedule diff is logged.

### 3.6 Live Game Tracker (flagship feature)
Thumb-reachable, one tap per event, runs in a mobile browser tab courtside.

**Layout:** score header with clock and period, two-column rosters, event pad at the bottom.

**Event flow:** tap player, tap event. Two taps maximum for common actions.

**Event types:** FG made (2 or 3), FG missed, FT made, FT missed, offensive rebound, defensive rebound, assist, steal, block, turnover, personal foul, technical foul, substitution, timeout, period start, period end, jump ball.

**Requirements:**
- Undo stack (unlimited within the game). Long-press any event in the log to edit or delete.
- Assist attaches to the immediately preceding made FG within a 10 second window, prompted inline.
- On-court tracking of five players per team so plus/minus computes automatically. Substitution updates the on-court set.
- Clock: start/stop, manual adjust, auto-advance period.
- **Offline first.** Gym Wi-Fi is bad. Queue events locally, sync on reconnect, resolve conflicts by event timestamp and a monotonic sequence number per game.
- Live broadcast: anyone viewing the game sees score and play-by-play updating in real time.
- Auto notification on final: "FINAL: Warriors 42, Hawks 38. Cohen: 18 pts, 7 reb."
- Post-game: box score confirmation screen, captains can flag a stat dispute, commissioner resolves.

### 3.7 Stats
- Per game: PTS, FGM/FGA, 3PM/3PA, FTM/FTA, OREB, DREB, REB, AST, STL, BLK, TO, PF, MIN, +/-.
- Derived: FG%, 3P%, FT%, TS%, eFG%, per-game averages, per-36 (optional), simple efficiency rating.
- Season leaderboards: filterable, sortable, top 10 per category, with a "qualified players" minimum-games rule.
- Player page: game log table, season splits, career totals across seasons, highs (career high, season high), team history.
- Team page: team totals and averages, point differential, roster, results log.
- League page: pace, scoring trends, weekly power rankings (computed: win pct, point diff, strength of schedule, last-5 form).

### 3.8 Standings
- W, L, T, PCT, GB, PF, PA, DIFF, STRK, L5, and division/conference splits if enabled.
- Configurable tiebreakers, ordered and drag-reorderable by the commissioner: head to head, point differential, points for, common opponents, coin flip.
- Live clinch/elimination indicators ("x: clinched playoff berth", "e: eliminated") computed from remaining schedule.

### 3.9 Trades
- Captain builds a proposal: any combination of players from their roster for players on another roster. Support 1-for-1, 2-for-1, and multi-team is out of scope for v1.
- Validation: both rosters must stay within min/max size after the trade.
- Flow: propose, counterparty captain accepts / declines / counters, then commissioner review (configurable: auto-approve, commissioner approval required, or league vote with a 24h window and a majority threshold).
- Trade deadline setting. Locks all trades after a date.
- Notifications at every state change.
- Public transaction log on the league feed: "TRADE: Warriors send Cohen to Hawks for Levy and Katz."

### 3.10 Playoffs
- Seeding auto-computed from final standings with the configured tiebreakers.
- Formats: single elimination, double elimination, best-of-N series, with optional play-in.
- Bracket view: interactive, responsive from desktop down to mobile, updates live as games finish.
- Bracket auto-advances winners. Commissioner can override.
- Championship page: trophy state, MVP, final box score, season awards.

### 3.11 Notifications
Categories, each individually toggleable per user:
- Game reminder (configurable lead time, default 30 min before slot)
- Schedule change or cancellation
- You're on the clock (draft)
- Trade offer received / accepted / declined / vetoed
- Final score for your team
- Weekly recap (Sunday night: your team's record, your stat line, next week's games)
- Availability nudge
- Standings milestone (clinched, eliminated, first place)
- Announcement from commissioner or captain

Also: in-app inbox mirroring all notifications, and deep links that open the exact page.

### 3.12 League feed and social
- Announcement posts from commissioners, team posts from captains.
- Auto-generated posts: trades, final scores, weekly power rankings, personal records broken, streaks.
- Reactions and comments.
- Weekly awards: Player of the Week (auto-computed plus commissioner override), and end-of-season voting for MVP, Best Defender, Most Improved, All-League First and Second Team.

---

## 4. DATA MODEL

Generate Postgres migrations for these tables. Every table gets `id uuid pk`, `created_at`, `updated_at`. Enable RLS on all of them.

```
organizations        id, name, slug, logo_url, email_domain
profiles             id (=auth.uid), full_name, avatar_url, grade, height_in, jersey_pref, positions[]
leagues              org_id, name, slug, sport, logo_url, primary_color, join_code, settings jsonb
league_members       league_id, user_id, role (commissioner|admin|captain|player|spectator), status
seasons              league_id, name, starts_on, ends_on, num_weeks, status, playoff_format jsonb, rules jsonb
time_slots           league_id, label, day_of_week, start_time, end_time, kind (lunch|free|after_school)
venues               league_id, name, capacity, splittable
teams                season_id, name, abbrev, color, logo_url, captain_id
team_members         team_id, user_id, jersey_number, joined_at, left_at, is_captain
drafts               season_id, format, pick_seconds, status, current_pick_no, order jsonb
draft_picks          draft_id, pick_no, round, team_id, user_id, made_at, auto_picked
draft_queues         draft_id, team_id, user_id, rank
availability         user_id, season_id, time_slot_id, status (yes|maybe|no), updated_at
availability_overrides user_id, date, time_slot_id, status, note
games                season_id, week, home_team_id, away_team_id, venue_id, time_slot_id, scheduled_date,
                     status (scheduled|live|final|forfeit|postponed), home_score, away_score,
                     scorekeeper_id, is_playoff, bracket_node_id
game_events          game_id, seq, period, clock_ms, team_id, user_id, type, value, related_user_id,
                     created_by, client_uuid (idempotency), voided
player_game_stats    game_id, user_id, team_id, MATERIALIZED aggregate columns, plus_minus, minutes
lineup_states        game_id, seq, team_id, on_court uuid[]
standings            season_id, team_id, w, l, t, pf, pa, streak, last5  (materialized view, refreshed on final)
trades               season_id, from_team_id, to_team_id, status, proposed_by, deadline_ok, resolved_by
trade_items          trade_id, user_id, from_team_id, to_team_id
trade_votes          trade_id, user_id, vote
bracket_nodes        season_id, round, position, home_source, away_source, game_id, winner_team_id
posts                league_id, season_id, author_id, team_id, kind (announcement|auto|team), body, meta jsonb
reactions            post_id, user_id, emoji
awards               season_id, kind, user_id, team_id, week, is_auto
push_subscriptions   user_id, endpoint, keys jsonb, active
notification_prefs   user_id, category, enabled, lead_minutes
audit_log            league_id, actor_id, action, target_type, target_id, before jsonb, after jsonb
```

**RLS principles:** league membership gates all reads. Writes gated by role. `game_events` writable only by the assigned scorekeeper or an admin, and only while the game status is `live`. `client_uuid` on `game_events` enforces idempotent offline sync via a unique constraint.

---

## 5. PAGES

1. Marketing landing page: hero, feature sections, "Start a league" CTA.
2. Public league page: standings, schedule, leaders, no login required, shareable.
3. Dashboard: my leagues, next game, my last stat line, pending actions. Mobile-first.
4. League home: feed, standings snapshot, this week's games, power rankings.
5. Commissioner console: settings, members, time slots, venues, rules, danger zone. Desktop-first.
6. Draft board: the live room described in 3.3. Responsive down to mobile.
7. Schedule builder: week tabs, drag-and-drop grid, auto-generate modal, conflict report panel. Desktop-first.
8. Availability: full-league heatmap and nudge tool for admins (desktop-first); personal weekly grid for players (mobile-first).
9. Live Game Tracker. Mobile-first, installable, offline-capable.
10. Game detail: box score, play-by-play, four-factor summary.
11. Standings (full, with tiebreaker explainer on hover/tap).
12. Stats hub: leaderboards, sortable full-league table, filters.
13. Player page. 14. Team page. 15. Trades center. 16. Playoff bracket. 17. Awards. 18. Notification preferences.

---

## 6. BUILD ORDER

**Phase 0: Foundation.** Auth, league creation, join by code, roster management, member roles, responsive shell (desktop admin layout + mobile player layout).

**Phase 1: Draft.** Draft config, realtime room, queues, timer, auto-pick, undo, recap.

**Phase 2: Availability and scheduling.** Time slots, venues, availability grids, heatmaps, scheduler logic, auto-generate, manual builder, conflict report, reschedule flow.

**Phase 3: Live tracking and stats.** Event model, tracker UI, offline queue and sync, stats logic, box scores, player and team pages, leaderboards, standings with tiebreakers.

**Phase 4: Trades and notifications.** Trade builder and approval flows, push notifications, preferences, scheduled jobs, in-app inbox, league feed.

**Phase 5: Playoffs and polish.** Seeding, brackets, series, awards, voting, public league pages, power rankings, weekly recap.

Ship each phase as a working, deployable increment. Do not build all schemas up front and all UI at the end.

---

## 7. ACCEPTANCE CRITERIA

The build is done when:
- A commissioner can go from zero to a fully drafted, fully scheduled 8-team league in under 20 minutes.
- A scorekeeper can track a complete game on a phone with no internet, and every event syncs correctly on reconnect with zero duplicates.
- Plus/minus computes correctly for every player without any manual input beyond substitutions.
- Every player receives a game reminder notification 30 minutes before their game, with a working deep link.
- The scheduler places at least 90 percent of matchups into slots meeting the availability threshold, and clearly reports the rest.
- Standings tiebreakers resolve deterministically and the app can explain why Team A is ranked above Team B.
- A trade goes from proposal to executed rosters with correct notifications at each step and a full audit trail.
- Stat and scheduling logic is fully unit tested and kept separate from UI code.

---

## 8. EDGE CASES TO HANDLE EXPLICITLY

Forfeits and how they count toward stats. Players who join mid-season (free agent pool). Players who quit or become ineligible. Ties when the rules do not allow them. Games that get cut short by the bell (partial game policy: configurable, count as final after a minimum period). Two games in the same slot at a splittable venue. A captain who gets traded. A commissioner who leaves the school. Duplicate jersey numbers. A player on two teams across two different leagues. Stat disputes after a game is final. Season rollover and career stat continuity.

---

## 9. CONSTRAINTS

- Users are high school students. Collect the minimum: name, email, grade level. No birthdates, no phone numbers required. Leagues are private by default; public pages expose stats and standings only, never emails.
- Design for a 30 second interaction. Most usage happens walking between classes, on a phone browser.
- Accessibility: all interactive targets at least 44pt, contrast at least 4.5:1, full screen-reader labels on the tracker.
- Everything must feel fast. Optimistic UI on every write.
