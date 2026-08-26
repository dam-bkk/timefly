import { describe, expect, it } from "vitest";
import { canApprove, canEditEntries, canReopen, canSubmit, canTransition, dailyTotals, dayStates, missingDays, weekSummary } from "./timesheet";
import { weekDays } from "./week";

describe("status machine", () => {
  it("allows the documented transitions only", () => {
    expect(canTransition("open", "submitted")).toBe(true);
    expect(canTransition("submitted", "approved")).toBe(true);
    expect(canTransition("submitted", "reopened")).toBe(true);
    expect(canTransition("approved", "reopened")).toBe(true);
    expect(canTransition("reopened", "submitted")).toBe(true);
    expect(canTransition("open", "approved")).toBe(false);
    expect(canTransition("approved", "submitted")).toBe(false);
  });
  it("gates edits by role and ownership", () => {
    expect(canEditEntries("open", "member", true)).toBe(true);
    expect(canEditEntries("reopened", "member", true)).toBe(true);
    expect(canEditEntries("submitted", "member", true)).toBe(false);
    expect(canEditEntries("open", "member", false)).toBe(false);
    expect(canEditEntries("approved", "manager", false)).toBe(true);
    expect(canEditEntries("approved", "admin", false)).toBe(true);
  });
  it("gates submit / approve / reopen", () => {
    expect(canSubmit("open", "member", true)).toBe(true);
    expect(canSubmit("open", "member", false)).toBe(false);
    expect(canSubmit("open", "admin", false)).toBe(true);
    expect(canSubmit("submitted", "member", true)).toBe(false);
    expect(canApprove("submitted", "manager", false)).toBe(true);
    expect(canApprove("submitted", "manager", true)).toBe(false);
    expect(canApprove("submitted", "member", false)).toBe(false);
    expect(canApprove("open", "admin", false)).toBe(false);
    expect(canReopen("approved", "manager")).toBe(true);
    expect(canReopen("submitted", "admin")).toBe(true);
    expect(canReopen("open", "manager")).toBe(false);
    expect(canReopen("approved", "member")).toBe(false);
  });
});

const week = weekDays("2026-08-24"); // Mon 24 – Sun 30
const entries = [
  { date: "2026-08-24", hours: 4 },
  { date: "2026-08-24", hours: 4.5 },
  { date: "2026-08-25", hours: 2 },
  { date: "2026-08-27", hours: 13 },
];

describe("day signals", () => {
  it("totals per day", () => {
    expect(dailyTotals(entries)).toEqual({ "2026-08-24": 8.5, "2026-08-25": 2, "2026-08-27": 13 });
  });
  it("classifies each day", () => {
    const s = dayStates(week, entries, { today: "2026-08-27", target: 8 });
    expect(s["2026-08-24"]).toBe("ok");
    expect(s["2026-08-25"]).toBe("short");
    expect(s["2026-08-26"]).toBe("missing");
    expect(s["2026-08-27"]).toBe("over");
    expect(s["2026-08-28"]).toBe("future");
    expect(s["2026-08-29"]).toBe("off");
    expect(s["2026-08-30"]).toBe("off");
  });
  it("respects holidays and a custom minimum", () => {
    const s = dayStates(week, entries, { today: "2026-08-28", target: 8, minHours: 1, holidays: ["2026-08-26"] });
    expect(s["2026-08-25"]).toBe("ok");
    expect(s["2026-08-26"]).toBe("off");
    expect(s["2026-08-28"]).toBe("missing");
  });
  it("lists missing days", () => {
    expect(missingDays(week, entries, { today: "2026-08-28", target: 8 })).toEqual(["2026-08-26", "2026-08-28"]);
  });
  it("summarises the week against the elapsed target", () => {
    const s = weekSummary(week, entries, { today: "2026-08-27", target: 8 });
    expect(s.total).toBe(23.5);
    expect(s.target).toBe(40);
    expect(s.workingDays).toBe(5);
    expect(s.missing).toEqual(["2026-08-26"]);
    expect(s.completion).toBe(0.73);
    expect(weekSummary(["2026-08-29"], [], { today: "2026-08-29", target: 8 }).completion).toBe(0);
    expect(weekSummary(week, [{ date: "2026-08-24", hours: 40 }], { today: "2026-08-24", target: 8 }).completion).toBe(1);
  });
});
