import { describe, expect, it } from "vitest";
import {
  dueAt,
  dueKinds,
  emailBody,
  emailSubject,
  formatLocalTime,
  morningOf,
  placeLine,
  smsBody,
  zoneOffsetMs,
  type ReminderContext,
  type ScheduledGame,
} from "./reminders";

const NY = "America/New_York";

/** A game at 11:40am New York time on a Wednesday in January (EST). */
const WINTER: ScheduledGame = {
  gameId: "g1",
  startsAt: "2026-01-14T16:40:00.000Z", // 11:40 EST
  timezone: NY,
  status: "scheduled",
};

/** The same wall-clock time in July (EDT) — one hour further from UTC. */
const SUMMER: ScheduledGame = {
  gameId: "g2",
  startsAt: "2026-07-15T15:40:00.000Z", // 11:40 EDT
  timezone: NY,
  status: "scheduled",
};

describe("zone handling", () => {
  it("measures the offset on both sides of DST", () => {
    expect(zoneOffsetMs(new Date(WINTER.startsAt), NY)).toBe(-5 * 3600_000);
    expect(zoneOffsetMs(new Date(SUMMER.startsAt), NY)).toBe(-4 * 3600_000);
  });

  it("puts 7:15 on the right local morning in both", () => {
    expect(formatLocalTime(morningOf(new Date(WINTER.startsAt), NY).toISOString(), NY))
      .toBe("7:15 AM");
    expect(formatLocalTime(morningOf(new Date(SUMMER.startsAt), NY).toISOString(), NY))
      .toBe("7:15 AM");
  });

  it("uses the game's own calendar day, not UTC's", () => {
    // 00:30 UTC on the 15th is still the evening of the 14th in New York, so
    // the morning notice belongs to the 14th.
    const lateNight: ScheduledGame = {
      ...WINTER,
      startsAt: "2026-01-15T00:30:00.000Z",
    };
    const morning = morningOf(new Date(lateNight.startsAt), NY);
    expect(
      new Intl.DateTimeFormat("en-US", { timeZone: NY, day: "numeric" }).format(morning),
    ).toBe("14");
  });

  it("handles a zone east of UTC", () => {
    const tokyo: ScheduledGame = {
      ...WINTER,
      timezone: "Asia/Tokyo",
      startsAt: "2026-01-14T02:40:00.000Z", // 11:40 JST
    };
    expect(formatLocalTime(morningOf(new Date(tokyo.startsAt), "Asia/Tokyo").toISOString(), "Asia/Tokyo"))
      .toBe("7:15 AM");
  });
});

describe("dueAt", () => {
  it("places the hour and ten-minute marks", () => {
    expect(dueAt(WINTER, "hour").toISOString()).toBe("2026-01-14T15:40:00.000Z");
    expect(dueAt(WINTER, "ten").toISOString()).toBe("2026-01-14T16:30:00.000Z");
  });

  it("places the morning mark at 7:15 local", () => {
    expect(dueAt(WINTER, "morning").toISOString()).toBe("2026-01-14T12:15:00.000Z");
  });
});

describe("dueKinds", () => {
  const at = (iso: string) => dueKinds(WINTER, new Date(iso));

  it("fires nothing before the morning mark", () => {
    expect(at("2026-01-14T12:00:00Z")).toEqual([]);
  });

  it("fires the morning notice on the tick and through its window", () => {
    expect(at("2026-01-14T12:15:00Z")).toEqual(["morning"]);
    expect(at("2026-01-14T13:44:00Z")).toEqual(["morning"]);
  });

  it("stops sending a morning notice once it is stale", () => {
    expect(at("2026-01-14T13:46:00Z")).toEqual([]);
  });

  it("fires the hour and ten-minute notices in their own windows", () => {
    expect(at("2026-01-14T15:41:00Z")).toEqual(["hour"]);
    expect(at("2026-01-14T16:31:00Z")).toEqual(["ten"]);
  });

  it("never sends the ten-minute notice after tip-off", () => {
    // The window is 8 minutes, so by tip-off it has already closed.
    expect(at("2026-01-14T16:40:00Z")).toEqual([]);
  });

  it("cannot collapse two kinds into one run", () => {
    // Windows are shorter than the gaps between marks, so no instant is ever
    // inside two of them.
    for (let m = 0; m < 24 * 60; m += 1) {
      const now = new Date(Date.UTC(2026, 0, 14, 0, m));
      expect(dueKinds(WINTER, now).length).toBeLessThanOrEqual(1);
    }
  });

  it("stays silent for a game that is already final", () => {
    expect(dueKinds({ ...WINTER, status: "final" }, new Date("2026-01-14T15:41:00Z")))
      .toEqual([]);
  });
});

describe("copy", () => {
  const ctx: ReminderContext = {
    playerName: "Harry Stone",
    teamName: "Panthers",
    opponentName: "Comets",
    isHome: true,
    startsAt: WINTER.startsAt,
    timezone: NY,
    venueName: "Main Gym",
    slotLabel: "Period 4 Lunch",
    leagueName: "Example MS Hoops",
    url: "https://intramural.app/league/demo/game/g1",
  };

  it("names the opponent, the time and the place in the subject and body", () => {
    expect(emailSubject("hour", ctx)).toContain("Comets");
    expect(emailSubject("hour", ctx)).toContain("11:40 AM");
    const body = emailBody("hour", ctx);
    expect(body).toContain("Panthers vs Comets");
    expect(body).toContain("Main Gym · Period 4 Lunch");
    expect(body).toContain("Wednesday, January 14");
    expect(body).toContain(ctx.url);
  });

  it("greets by first name only", () => {
    expect(emailBody("morning", ctx).startsWith("Harry —")).toBe(true);
  });

  it("keeps a text short enough for one segment", () => {
    for (const kind of ["morning", "hour", "ten"] as const) {
      expect(smsBody(kind, ctx).length).toBeLessThanOrEqual(160);
    }
  });

  it("still says something useful with no venue or slot", () => {
    const bare = { ...ctx, venueName: null, slotLabel: null };
    expect(placeLine(bare)).toBe("Location TBD");
    expect(smsBody("ten", bare)).toContain("TBD");
  });

  it("says away when the player's team is the away side", () => {
    expect(emailBody("morning", { ...ctx, isHome: false })).toContain("(away)");
  });
});
