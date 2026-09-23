import { describe, expect, it } from "vitest";
import { clockLabel, slotRange } from "./time";

describe("clockLabel", () => {
  it("names the morning", () => {
    expect(clockLabel("10:11")).toBe("10:11 AM");
    expect(clockLabel("09:05")).toBe("9:05 AM");
  });

  it("names the afternoon", () => {
    expect(clockLabel("13:15")).toBe("1:15 PM");
    expect(clockLabel("15:15")).toBe("3:15 PM");
  });

  it("gets the two hours everyone gets wrong", () => {
    // 12:xx is PM and 00:xx is AM — the modulo has to leave both at 12.
    expect(clockLabel("12:00")).toBe("12:00 PM");
    expect(clockLabel("12:45")).toBe("12:45 PM");
    expect(clockLabel("00:30")).toBe("12:30 AM");
  });

  it("accepts the seconds Postgres adds", () => {
    expect(clockLabel("13:15:00")).toBe("1:15 PM");
  });

  it("hands back anything that isn't a time rather than inventing one", () => {
    expect(clockLabel("")).toBe("");
    expect(clockLabel("lunch")).toBe("lunch");
    expect(clockLabel("25:00")).toBe("25:00");
  });
});

describe("slotRange", () => {
  it("collapses the meridiem when both ends share it", () => {
    expect(slotRange("13:15", "13:51")).toBe("1:15–1:51 PM");
    expect(slotRange("10:11", "11:11")).toBe("10:11–11:11 AM");
  });

  it("keeps both when the slot straddles noon", () => {
    expect(slotRange("11:40", "12:10")).toBe("11:40 AM–12:10 PM");
  });

  it("treats noon itself as the afternoon side", () => {
    expect(slotRange("12:05", "12:45")).toBe("12:05–12:45 PM");
  });

  it("degrades to two labels if either end is unparseable", () => {
    expect(slotRange("13:15", "nope")).toBe("1:15 PM–nope");
  });
});
