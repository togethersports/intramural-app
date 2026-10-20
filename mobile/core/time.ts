/**
 * Clock times, the way a school says them.
 *
 * Slot times are stored 24-hour ("HH:MM", sometimes "HH:MM:SS") because that
 * is what `<input type="time">` posts and what a Postgres `time` column
 * hands back. Nobody in a gym says "thirteen fifteen", so nothing renders
 * them that way.
 *
 * Pure string work on purpose: a slot time is a wall-clock time in the
 * league's day, not an instant. Putting it through `Date` would drag a
 * timezone into a value that does not have one, and a Monday 13:15 slot
 * would read differently depending on who opened the page.
 */

/** 0 → 12, 13 → 1, 23 → 11. */
function hour12(h: number): number {
  return ((h + 11) % 12) + 1;
}

function parse(value: string): { h: number; m: number } | null {
  const [rawH, rawM] = value.split(":");
  const h = Number(rawH);
  const m = Number(rawM);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

/** "13:15" → "1:15 PM". Returns the input untouched if it isn't a time. */
export function clockLabel(value: string): string {
  const t = parse(value);
  if (!t) return value;
  const meridiem = t.h < 12 ? "AM" : "PM";
  return `${hour12(t.h)}:${String(t.m).padStart(2, "0")} ${meridiem}`;
}

/**
 * "13:15", "13:51" → "1:15–1:51 PM".
 *
 * The meridiem collapses onto the end when both ends share one, which is how
 * a period is written on a schedule. A range that straddles noon keeps both
 * ("11:40 AM–12:10 PM"), because that is the one case where dropping the
 * first is genuinely ambiguous.
 */
export function slotRange(start: string, end: string): string {
  const a = parse(start);
  const b = parse(end);
  if (!a || !b) return `${clockLabel(start)}–${clockLabel(end)}`;
  const sameHalf = a.h < 12 === b.h < 12;
  const from = sameHalf
    ? `${hour12(a.h)}:${String(a.m).padStart(2, "0")}`
    : clockLabel(start);
  return `${from}–${clockLabel(end)}`;
}
