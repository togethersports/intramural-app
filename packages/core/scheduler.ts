// Schedule generation: greedy assignment over scored candidate cells with a
// backtracking rescue pass, per BRIEF §3.5. Pure + deterministic — unit
// tested in scheduler.test.ts.

export interface SchedulerSlot {
  id: string;
  dayOfWeek: number; // 0 = Sunday, matches time_slots.day_of_week
  label: string;
}

export interface SchedulerVenue {
  id: string;
  splittable: boolean;
}

export interface SchedulerInput {
  teams: string[];
  weeks: number;
  slots: SchedulerSlot[];
  venues: SchedulerVenue[];
  /** availability[teamId][slotId] = number of players available (yes + maybe/2) */
  availability: Record<string, Record<string, number>>;
  /** reject a cell when either team has fewer than this available (default 4) */
  minPlayers?: number;
  maxGamesPerTeamPerWeek?: number;
  /** how many times each pair meets (default 1) */
  matchupsPerPair?: number;
}

export interface ScheduledGame {
  week: number; // 1-based
  home: string;
  away: string;
  slotId: string;
  venueId: string;
  score: number; // min joint availability at assignment time
}

export interface Conflict {
  matchup: [string, string];
  reason: string;
}

export interface ScheduleResult {
  games: ScheduledGame[];
  conflicts: Conflict[];
}

interface Matchup {
  a: string;
  b: string;
  round: number;
}

/** Circle-method round robin. Returns rounds of team pairs. */
export function roundRobin(teams: string[]): [string, string][][] {
  const list = [...teams];
  if (list.length % 2 === 1) list.push("__bye__");
  const n = list.length;
  const rounds: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const round: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = list[i];
      const b = list[n - 1 - i];
      if (a !== "__bye__" && b !== "__bye__") {
        // alternate home/away by round for balance
        round.push(r % 2 === 0 ? [a, b] : [b, a]);
      }
    }
    rounds.push(round);
    // rotate all but the first
    list.splice(1, 0, list.pop()!);
  }
  return rounds;
}

export function generateSchedule(input: SchedulerInput): ScheduleResult {
  const {
    teams,
    weeks,
    slots,
    venues,
    availability,
    minPlayers = 4,
    maxGamesPerTeamPerWeek = 1,
    matchupsPerPair = 1,
  } = input;

  const games: ScheduledGame[] = [];
  const conflicts: Conflict[] = [];
  if (teams.length < 2 || weeks < 1 || slots.length === 0 || venues.length === 0) {
    return {
      games,
      conflicts: [{ matchup: ["—", "—"], reason: "Need at least 2 teams, 1 week, 1 slot and 1 venue" }],
    };
  }

  // matchup list: each round-robin cycle repeated matchupsPerPair times
  const rounds = roundRobin(teams);
  const matchups: Matchup[] = [];
  for (let cycle = 0; cycle < matchupsPerPair; cycle++) {
    rounds.forEach((round, r) => {
      for (const [a, b] of round) {
        // swap home/away on repeat cycles
        matchups.push(
          cycle % 2 === 0
            ? { a, b, round: cycle * rounds.length + r }
            : { a: b, b: a, round: cycle * rounds.length + r },
        );
      }
    });
  }

  // occupancy
  const cellUsed = new Map<string, number>(); // `${week}:${slot}:${venue}` → games
  const teamWeek = new Map<string, number>(); // `${week}:${team}` → games
  const teamWeekSlot = new Set<string>(); // `${week}:${team}:${slot}` — no double-booking a team in a slot
  const teamSlotCount = new Map<string, number>(); // `${team}:${slot}` → times assigned (equity)

  const avail = (team: string, slot: string) => availability[team]?.[slot] ?? 0;

  const venueCap = (v: SchedulerVenue) => (v.splittable ? 2 : 1);

  function bestCell(
    m: Matchup,
    week: number,
  ): { slotId: string; venueId: string; score: number } | null {
    let best: { slotId: string; venueId: string; score: number; sortKey: number } | null = null;
    for (const slot of slots) {
      const joint = Math.min(avail(m.a, slot.id), avail(m.b, slot.id));
      if (joint < minPlayers) continue;
      if (teamWeekSlot.has(`${week}:${m.a}:${slot.id}`)) continue;
      if (teamWeekSlot.has(`${week}:${m.b}:${slot.id}`)) continue;
      for (const venue of venues) {
        const key = `${week}:${slot.id}:${venue.id}`;
        if ((cellUsed.get(key) ?? 0) >= venueCap(venue)) continue;
        // slot equity: soft penalty for repeating the same slot for a team
        const repeats =
          (teamSlotCount.get(`${m.a}:${slot.id}`) ?? 0) +
          (teamSlotCount.get(`${m.b}:${slot.id}`) ?? 0);
        const sortKey = joint - 0.4 * repeats;
        if (!best || sortKey > best.sortKey) {
          best = { slotId: slot.id, venueId: venue.id, score: joint, sortKey };
        }
      }
    }
    return best ? { slotId: best.slotId, venueId: best.venueId, score: best.score } : null;
  }

  function canPlace(m: Matchup, week: number) {
    return (
      (teamWeek.get(`${week}:${m.a}`) ?? 0) < maxGamesPerTeamPerWeek &&
      (teamWeek.get(`${week}:${m.b}`) ?? 0) < maxGamesPerTeamPerWeek
    );
  }

  function place(m: Matchup, week: number, cell: { slotId: string; venueId: string; score: number }) {
    games.push({ week, home: m.a, away: m.b, slotId: cell.slotId, venueId: cell.venueId, score: cell.score });
    cellUsed.set(`${week}:${cell.slotId}:${cell.venueId}`, (cellUsed.get(`${week}:${cell.slotId}:${cell.venueId}`) ?? 0) + 1);
    teamWeek.set(`${week}:${m.a}`, (teamWeek.get(`${week}:${m.a}`) ?? 0) + 1);
    teamWeek.set(`${week}:${m.b}`, (teamWeek.get(`${week}:${m.b}`) ?? 0) + 1);
    teamWeekSlot.add(`${week}:${m.a}:${cell.slotId}`);
    teamWeekSlot.add(`${week}:${m.b}:${cell.slotId}`);
    teamSlotCount.set(`${m.a}:${cell.slotId}`, (teamSlotCount.get(`${m.a}:${cell.slotId}`) ?? 0) + 1);
    teamSlotCount.set(`${m.b}:${cell.slotId}`, (teamSlotCount.get(`${m.b}:${cell.slotId}`) ?? 0) + 1);
  }

  // ---------------------------------------------------------------- greedy
  const unplaced: Matchup[] = [];
  matchups.forEach((m) => {
    // target week: spread rounds across the season
    const target = (m.round % weeks) + 1;
    let placed = false;
    // try target week first, then the rest in order
    const weekOrder = [
      target,
      ...Array.from({ length: weeks }, (_, i) => i + 1).filter((w) => w !== target),
    ];
    for (const week of weekOrder) {
      if (!canPlace(m, week)) continue;
      const cell = bestCell(m, week);
      if (cell) {
        place(m, week, cell);
        placed = true;
        break;
      }
    }
    if (!placed) unplaced.push(m);
  });

  // ----------------------------------------------------------- backtracking
  // For each unplaced matchup, try evicting one placed game to a different
  // cell and taking its spot.
  for (const m of [...unplaced]) {
    let rescued = false;
    outer: for (let gi = 0; gi < games.length; gi++) {
      const g = games[gi];
      // could m use g's cell?
      const jointHere = Math.min(avail(m.a, g.slotId), avail(m.b, g.slotId));
      if (jointHere < minPlayers) continue;
      if (
        (teamWeek.get(`${g.week}:${m.a}`) ?? 0) >= maxGamesPerTeamPerWeek ||
        (teamWeek.get(`${g.week}:${m.b}`) ?? 0) >= maxGamesPerTeamPerWeek
      )
        continue;
      // can g move somewhere else?
      const gm: Matchup = { a: g.home, b: g.away, round: 0 };
      for (let week = 1; week <= weeks; week++) {
        // temporarily remove g
        const snapshot = { games: [...games] };
        games.splice(gi, 1);
        rebuildOccupancy();
        if (canPlace(gm, week)) {
          const cell = bestCell(gm, week);
          if (cell) {
            place(gm, week, cell);
            // now place m in g's old cell if still valid
            if (canPlace(m, g.week)) {
              const mCell = bestCell(m, g.week);
              if (mCell) {
                place(m, g.week, mCell);
                unplaced.splice(unplaced.indexOf(m), 1);
                rescued = true;
                break outer;
              }
            }
          }
        }
        // restore
        games.length = 0;
        games.push(...snapshot.games);
        rebuildOccupancy();
      }
    }
    if (!rescued) {
      // diagnose why
      const anySlotMeetsThreshold = slots.some(
        (s) => Math.min(avail(m.a, s.id), avail(m.b, s.id)) >= minPlayers,
      );
      conflicts.push({
        matchup: [m.a, m.b],
        reason: anySlotMeetsThreshold
          ? "No open venue/slot cell left in any week (capacity exhausted)"
          : `No time slot where both teams have at least ${minPlayers} players available`,
      });
    }
  }

  function rebuildOccupancy() {
    cellUsed.clear();
    teamWeek.clear();
    teamWeekSlot.clear();
    teamSlotCount.clear();
    for (const g of games) {
      cellUsed.set(`${g.week}:${g.slotId}:${g.venueId}`, (cellUsed.get(`${g.week}:${g.slotId}:${g.venueId}`) ?? 0) + 1);
      teamWeek.set(`${g.week}:${g.home}`, (teamWeek.get(`${g.week}:${g.home}`) ?? 0) + 1);
      teamWeek.set(`${g.week}:${g.away}`, (teamWeek.get(`${g.week}:${g.away}`) ?? 0) + 1);
      teamWeekSlot.add(`${g.week}:${g.home}:${g.slotId}`);
      teamWeekSlot.add(`${g.week}:${g.away}:${g.slotId}`);
      teamSlotCount.set(`${g.home}:${g.slotId}`, (teamSlotCount.get(`${g.home}:${g.slotId}`) ?? 0) + 1);
      teamSlotCount.set(`${g.away}:${g.slotId}`, (teamSlotCount.get(`${g.away}:${g.slotId}`) ?? 0) + 1);
    }
  }

  // Code-unit compare, not localeCompare: collation differs between Hermes
  // (Apple Foundation on iOS) and Node (ICU), and this is a determinism
  // guarantee, not a human-facing sort.
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  // A splittable venue holds two games in the SAME week, slot and venue, so
  // week+slot alone is not a total order — it would leave those two to sort
  // stability. Carry on through venue and the teams so the order is fully
  // determined by the data.
  games.sort(
    (a, b) =>
      a.week - b.week ||
      cmp(a.slotId, b.slotId) ||
      cmp(a.venueId, b.venueId) ||
      cmp(a.home, b.home) ||
      cmp(a.away, b.away),
  );
  return { games, conflicts };
}

/** Date of a slot occurrence in a given season week (week is 1-based). */
export function slotDateFor(
  seasonStart: string, // ISO date
  week: number,
  dayOfWeek: number,
): string {
  const start = new Date(`${seasonStart}T00:00:00Z`);
  const startDow = start.getUTCDay();
  const offsetToDow = (dayOfWeek - startDow + 7) % 7;
  const d = new Date(start);
  d.setUTCDate(start.getUTCDate() + (week - 1) * 7 + offsetToDow);
  return d.toISOString().slice(0, 10);
}
