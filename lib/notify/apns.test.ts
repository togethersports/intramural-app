import { afterEach, describe, expect, it } from "vitest";
import { isPushConfigured, parseReason } from "./apns";
import { channelsFor } from "./index";

const KEYS = ["APNS_KEY_P8", "APNS_KEY_ID", "APNS_TEAM_ID"] as const;

afterEach(() => {
  for (const k of KEYS) delete process.env[k];
});

describe("isPushConfigured", () => {
  it("needs all three, not some", () => {
    expect(isPushConfigured()).toBe(false);
    process.env.APNS_KEY_P8 = "-----BEGIN PRIVATE KEY-----";
    expect(isPushConfigured()).toBe(false);
    process.env.APNS_KEY_ID = "ABC123";
    // Two of three is the dangerous case: enough to look set up, not enough
    // to sign. It must still report unconfigured rather than throw at send.
    expect(isPushConfigured()).toBe(false);
    process.env.APNS_TEAM_ID = "TEAM123";
    expect(isPushConfigured()).toBe(true);
  });
});

describe("parseReason", () => {
  it("reads Apple's error body", () => {
    expect(parseReason('{"reason":"BadDeviceToken"}')).toBe("BadDeviceToken");
    expect(parseReason('{"reason":"Unregistered"}')).toBe("Unregistered");
  });

  it("is quiet on an empty body — that is what success looks like", () => {
    expect(parseReason("")).toBeNull();
  });

  it("does not throw on a body that isn't JSON", () => {
    // A proxy or a gateway error page can arrive here. Returning null makes
    // the caller fall back to the HTTP status, which is still useful.
    expect(parseReason("<html>502</html>")).toBeNull();
    expect(parseReason("{oops")).toBeNull();
  });
});

describe("channelsFor with a device", () => {
  const contact = { email: "a@b.c", phone: "+15551234567" };

  it("adds push for any preference except none", () => {
    expect(channelsFor("email", { ...contact, hasDevice: true })).toContain("push");
    expect(channelsFor("sms", { ...contact, hasDevice: true })).toContain("push");
    expect(channelsFor("both", { ...contact, hasDevice: true })).toContain("push");
  });

  it("treats none as a global mute, not an email/SMS setting", () => {
    // Someone who turned everything off should not be buzzed on the wrist
    // just because the watch app happens to be installed.
    expect(channelsFor("none", { ...contact, hasDevice: true })).toEqual([]);
  });

  it("does not push to someone with no registered device", () => {
    expect(channelsFor("both", contact)).toEqual(["email", "sms"]);
    expect(channelsFor("both", { ...contact, hasDevice: false })).toEqual([
      "email",
      "sms",
    ]);
  });

  it("can push to someone we have no address for at all", () => {
    // The watch signs in by itself and may be the only thing we can reach —
    // no email on the profile must not mean no notification.
    expect(
      channelsFor("email", { email: null, phone: null, hasDevice: true }),
    ).toEqual(["push"]);
  });
});
