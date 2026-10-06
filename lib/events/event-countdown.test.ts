import { describe, expect, it } from "vitest";
import { getEventCountdown } from "./event-countdown";

describe("event countdown", () => {
  it("counts to Brasília midnight regardless of the device timezone", () => {
    const result = getEventCountdown("2026-10-10", Date.parse("2026-10-08T23:57:56-03:00"));
    expect(result).toEqual({ days: 1, hours: 0, minutes: 2, seconds: 4, status: "upcoming" });
    expect(getEventCountdown("2026-10-10", Date.parse("2026-10-10T02:00:00Z")))
      .toMatchObject({ days: 0, hours: 1, status: "upcoming" });
  });

  it("does not finish before the final second has elapsed", () => {
    expect(getEventCountdown("2026-10-10", Date.parse("2026-10-10T02:59:59.500Z")))
      .toMatchObject({ seconds: 1, status: "upcoming" });
  });

  it("shows today throughout the event date without negative values", () => {
    for (const now of ["2026-10-10T03:00:00Z", "2026-10-11T02:59:59Z"]) {
      expect(getEventCountdown("2026-10-10", Date.parse(now)))
        .toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, status: "today" });
    }
  });

  it("recognizes past events after the end of their day", () => {
    expect(getEventCountdown("2026-10-10", Date.parse("2026-10-11T03:00:00Z")))
      .toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, status: "past" });
  });
});
