import { describe, expect, it } from "vitest";
import { addDays, dayOfWeek, eachDay, isISODate, isWeekend, isoWeekNumber, longDate, monthBounds, monthLabel, parseISODate, shortDate, shortDay, startOfWeek, toISODate, weekDays, weekLabel } from "./week";

describe("ISO dates", () => {
  it("round-trips", () => {
    expect(toISODate(parseISODate("2026-08-26"))).toBe("2026-08-26");
    expect(isISODate("2026-02-29")).toBe(false);
    expect(isISODate("2024-02-29")).toBe(true);
    expect(isISODate(42)).toBe(false);
    expect(() => parseISODate("26/08/2026")).toThrow();
  });
  it("adds days across month and year ends", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });
  it("knows weekdays and weekends", () => {
    expect(dayOfWeek("2026-08-26")).toBe(3);
    expect(shortDay("2026-08-26")).toBe("Wed");
    expect(isWeekend("2026-08-29")).toBe(true);
    expect(isWeekend("2026-08-30")).toBe(true);
    expect(isWeekend("2026-08-28")).toBe(false);
  });
});

describe("weeks", () => {
  it("starts on Monday by default and Sunday on request", () => {
    expect(startOfWeek("2026-08-26")).toBe("2026-08-24");
    expect(startOfWeek("2026-08-24")).toBe("2026-08-24");
    expect(startOfWeek("2026-08-30")).toBe("2026-08-24");
    expect(startOfWeek("2026-08-26", 0)).toBe("2026-08-23");
  });
  it("lists seven days", () => {
    const days = weekDays("2026-08-24");
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-08-24");
    expect(days[6]).toBe("2026-08-30");
  });
  it("labels weeks in the three shapes", () => {
    expect(weekLabel("2026-08-24")).toBe("24 – 30 Aug 2026");
    expect(weekLabel("2026-08-31")).toBe("31 Aug – 6 Sep 2026");
    expect(weekLabel("2025-12-29")).toBe("29 Dec 2025 – 4 Jan 2026");
  });
  it("computes ISO week numbers", () => {
    expect(isoWeekNumber("2026-08-26")).toBe(35);
    expect(isoWeekNumber("2026-01-01")).toBe(1);
    expect(isoWeekNumber("2027-01-01")).toBe(53);
  });
});

describe("months and ranges", () => {
  it("bounds a month", () => {
    expect(monthBounds("2026-02-10")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthLabel("2026-02-10")).toBe("Feb 2026");
  });
  it("enumerates days inclusively", () => {
    expect(eachDay("2026-08-30", "2026-09-01")).toEqual(["2026-08-30", "2026-08-31", "2026-09-01"]);
    expect(eachDay("2026-09-01", "2026-08-30")).toEqual([]);
  });
  it("formats", () => {
    expect(shortDate("2026-08-05")).toBe("5 Aug");
    expect(longDate("2026-08-05")).toBe("Wed 5 Aug 2026");
  });
});
