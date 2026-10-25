import { describe, expect, it } from "vitest";
import { formatDate, formatShortDate, isLaterDay } from "./formatDate";

describe("formatDate", () => {
  it("shows the frontmatter day regardless of the build machine timezone", () => {
    // This suite runs in the machine's local TZ (not UTC in CI or on the
    // author's machine); UTC-midnight dates must not shift a day.
    expect(formatDate(new Date("2026-08-07T00:00:00.000Z"))).toBe(
      "August 7, 2026",
    );
  });

  it("formats the last instant of a UTC day as that day", () => {
    expect(formatDate(new Date("2026-12-31T23:59:59.999Z"))).toBe(
      "December 31, 2026",
    );
  });
});

describe("formatShortDate", () => {
  it("abbreviates the month and keeps the day pinned to UTC", () => {
    expect(formatShortDate(new Date("2026-08-07T00:00:00.000Z"))).toBe(
      "Aug 7, 2026",
    );
  });
});

describe("isLaterDay", () => {
  it("is false for the same calendar day, whatever the time", () => {
    expect(
      isLaterDay(
        new Date("2026-08-07T23:59:59.999Z"),
        new Date("2026-08-07T00:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("is true for a later day, even a moment later", () => {
    expect(
      isLaterDay(
        new Date("2026-08-08T00:00:00.000Z"),
        new Date("2026-08-07T23:59:59.999Z"),
      ),
    ).toBe(true);
  });

  it("is false for an earlier day", () => {
    expect(
      isLaterDay(
        new Date("2026-08-06T00:00:00.000Z"),
        new Date("2026-08-07T00:00:00.000Z"),
      ),
    ).toBe(false);
  });
});
