import { describe, expect, it } from "vitest";
import { formatHours, parseHours, roundHours, sumHours } from "./hours";

describe("parseHours", () => {
  it("accepts the ways people type hours", () => {
    expect(parseHours("1.5")).toBe(1.5);
    expect(parseHours("1,5")).toBe(1.5);
    expect(parseHours("1:30")).toBe(1.5);
    expect(parseHours("1h30")).toBe(1.5);
    expect(parseHours("1h30m")).toBe(1.5);
    expect(parseHours("1h")).toBe(1);
    expect(parseHours("90m")).toBe(1.5);
    expect(parseHours(".5")).toBe(0.5);
    expect(parseHours("8")).toBe(8);
    expect(parseHours(" 2.25 ")).toBe(2.25);
    expect(parseHours("0")).toBe(0);
  });
  it("rejects nonsense and clears on empty", () => {
    expect(parseHours("")).toBeNull();
    expect(parseHours("   ")).toBeNull();
    expect(parseHours(null)).toBeNull();
    expect(parseHours(undefined)).toBeNull();
    expect(parseHours("abc")).toBeNull();
    expect(parseHours(".")).toBeNull();
    expect(parseHours("1:75")).toBeNull();
    expect(parseHours("-1")).toBeNull();
  });
  it("caps at 24", () => {
    expect(parseHours("30")).toBe(24);
    expect(parseHours("24:30")).toBe(24);
  });
});

describe("roundHours / formatHours / sumHours", () => {
  it("rounds to a step", () => {
    expect(roundHours(1.37)).toBe(1.25);
    expect(roundHours(1.38)).toBe(1.5);
    expect(roundHours(1.37, 0.1)).toBe(1.4);
    expect(roundHours(1.37, 0)).toBe(1.37);
  });
  it("formats decimal and clock", () => {
    expect(formatHours(1.5)).toBe("1.5");
    expect(formatHours(8)).toBe("8");
    expect(formatHours(2.25)).toBe("2.25");
    expect(formatHours(1.5, "clock")).toBe("1:30");
    expect(formatHours(0.25, "clock")).toBe("0:15");
    expect(formatHours(0)).toBe("");
    expect(formatHours(null, "decimal", { zero: "0" })).toBe("0");
    expect(formatHours(undefined)).toBe("");
  });
  it("sums without float noise", () => {
    expect(sumHours([0.1, 0.2, null, undefined, 0.7])).toBe(1);
    expect(sumHours([])).toBe(0);
  });
});
