// What a reminder says, and when it is due.
//
// Pure: no database, no network, no clock of its own. The sender passes in
// "now" and a list of games; this decides which reminders are due and what
// each one reads like. That makes the timing rules — which are the part that
// silently goes wrong — unit-testable without a mail provider.

export type ReminderKind = "morning" | "hour" | "ten";

export const REMINDER_KINDS: ReminderKind[] = ["morning", "hour", "ten"];

/** Local wall-clock time of the morning-of reminder. */
export const MORNING_HOUR = 7;
export const MORNING_MINUTE = 15;

const MINUTE = 60_000;

/**
 * How late a reminder may fire and still be worth sending.
 *
 * The cron runs on a fixed cadence, so a due moment almost never lands
 * exactly on a tick. The window absorbs that. It is deliberately shorter
 * than the gap between kinds so two reminders can never collapse into one
 * another, and shorter than the ten-minute warning so a late run doesn't
 * text somebody about a game that has already tipped off.
 */
export const WINDOW_MINUTES: Record<ReminderKind, number> = {
  morning: 90,
  hour: 20,
  ten: 8,
};

export interface ScheduledGame {
  gameId: string;
  /** Tip-off as an ISO instant, already resolved from date + slot + zone. */
  startsAt: string;
  /** IANA zone, for rendering the local time in the copy. */
  timezone: string;
  status: string;
}

/**
 * The instant a given reminder for a given game becomes due.
 *
 * "The morning of" is 7:15 in the league's own zone, which is a wall-clock
 * question rather than an offset one — so it is computed by formatting the
 * tip-off into that zone and rebuilding the instant, not by subtracting
 * hours. That keeps it correct across a DST boundary.
 */
export function dueAt(game: ScheduledGame, kind: ReminderKind): Date {
  const start = new Date(game.startsAt);
  if (kind === "hour") return new Date(start.getTime() - 60 * MINUTE);
  if (kind === "ten") return new Date(start.getTime() - 10 * MINUTE);
  return morningOf(start, game.timezone);
}

/** 7:15am, in `timezone`, on the calendar day `instant` falls on there. */
export function morningOf(instant: Date, timezone: string): Date {
  const { year, month, day } = localParts(instant, timezone);
  // Guess at UTC, then correct by the zone's offset at that moment. One
  // correction is enough: an offset change inside a 24-hour window moves the
  // result by an hour at most, and re-measuring at the corrected instant
  // catches that.
  let guess = Date.UTC(year, month - 1, day, MORNING_HOUR, MORNING_MINUTE);
  for (let i = 0; i < 2; i++) {
    const offset = zoneOffsetMs(new Date(guess), timezone);
    const corrected = Date.UTC(year, month - 1, day, MORNING_HOUR, MORNING_MINUTE) - offset;
    if (corrected === guess) break;
    guess = corrected;
  }
  return new Date(guess);
}

function localParts(instant: Date, timezone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts: Record<string, number> = {};
  for (const p of fmt.formatToParts(instant)) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour % 24,
    minute: parts.minute,
    second: parts.second,
  };
}

/** The zone's UTC offset in milliseconds at `instant` (east of UTC positive). */
export function zoneOffsetMs(instant: Date, timezone: string): number {
  const p = localParts(instant, timezone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * Which reminders for this game are due as of `now`.
 *
 * A reminder is due when its moment has passed but not by more than its
 * window — so a job that was down for an hour catches up on the morning
 * notices and correctly skips the ten-minute ones it can no longer honour.
 */
export function dueKinds(game: ScheduledGame, now: Date): ReminderKind[] {
  if (game.status !== "scheduled" && game.status !== "postponed") return [];
  const out: ReminderKind[] = [];
  for (const kind of REMINDER_KINDS) {
    const due = dueAt(game, kind).getTime();
    const age = now.getTime() - due;
    if (age >= 0 && age <= WINDOW_MINUTES[kind] * MINUTE) out.push(kind);
  }
  return out;
}

/* --------------------------------- copy ---------------------------------- */

export interface ReminderContext {
  playerName: string;
  teamName: string;
  opponentName: string;
  /** True when the player's team is the home side. */
  isHome: boolean;
  startsAt: string;
  timezone: string;
  venueName: string | null;
  slotLabel: string | null;
  leagueName: string;
  /** Deep link into the app, absolute. */
  url: string;
}

export function formatLocalTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatLocalDate(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
}

/** "Main Gym · Period 4 Lunch", skipping whichever is missing. */
export function placeLine(ctx: ReminderContext): string {
  return [ctx.venueName, ctx.slotLabel].filter(Boolean).join(" · ") || "Location TBD";
}

const LEAD: Record<ReminderKind, string> = {
  morning: "You play today",
  hour: "You play in an hour",
  ten: "You're up in ten minutes",
};

export function emailSubject(kind: ReminderKind, ctx: ReminderContext): string {
  const time = formatLocalTime(ctx.startsAt, ctx.timezone);
  if (kind === "ten") return `${ctx.teamName} vs ${ctx.opponentName} — 10 minutes`;
  if (kind === "hour") return `${ctx.teamName} vs ${ctx.opponentName} at ${time} — one hour`;
  return `Today: ${ctx.teamName} vs ${ctx.opponentName} at ${time}`;
}

/** Plain text body. The HTML version renders the same sentences. */
export function emailBody(kind: ReminderKind, ctx: ReminderContext): string {
  const time = formatLocalTime(ctx.startsAt, ctx.timezone);
  const date = formatLocalDate(ctx.startsAt, ctx.timezone);
  const side = ctx.isHome ? "at home" : "away";
  return [
    `${ctx.playerName.split(" ")[0]} — ${LEAD[kind].toLowerCase()}.`,
    "",
    `${ctx.teamName} vs ${ctx.opponentName} (${side})`,
    `${date} at ${time}`,
    placeLine(ctx),
    "",
    `Open the game: ${ctx.url}`,
    "",
    `${ctx.leagueName} · Intramural`,
  ].join("\n");
}

/**
 * Short enough for one SMS segment (160 GSM-7 characters) in the common
 * case, so a reminder costs one message rather than three.
 */
export function smsBody(kind: ReminderKind, ctx: ReminderContext): string {
  const time = formatLocalTime(ctx.startsAt, ctx.timezone);
  const where = ctx.venueName ?? ctx.slotLabel ?? "TBD";
  const lead =
    kind === "ten" ? "10 min" : kind === "hour" ? "1 hr" : `Today ${time}`;
  const head = kind === "morning" ? lead : `${lead} — ${time}`;
  return `${head}: ${ctx.teamName} vs ${ctx.opponentName}, ${where}. ${ctx.url}`;
}
