import { describe, expect, it } from "vitest";
import { budgetBurn, pivot, utilisation } from "./report";
import { toCsv } from "./csv";

const rows = [
  { who: "Siti", proj: "eStore", h: 4 },
  { who: "Siti", proj: "eStore", h: 2.5 },
  { who: "Siti", proj: "Lisa", h: 1 },
  { who: "Rahul", proj: "Lisa", h: 8 },
];

describe("pivot", () => {
  it("builds a two-way table with totals", () => {
    const p = pivot(rows, (r) => r.who, (r) => r.proj, (r) => r.h);
    expect(p.rows).toEqual(["Rahul", "Siti"]);
    expect(p.cols).toEqual(["Lisa", "eStore"]);
    expect(p.cell("Siti", "eStore")).toBe(6.5);
    expect(p.cell("Rahul", "eStore")).toBe(0);
    expect(p.rowTotal("Siti")).toBe(7.5);
    expect(p.colTotal("Lisa")).toBe(9);
    expect(p.grand).toBe(15.5);
    expect(p.rowTotal("Nobody")).toBe(0);
    expect(p.colTotal("Nothing")).toBe(0);
  });
  it("accepts custom orders", () => {
    const p = pivot(rows, (r) => r.who, (r) => r.proj, (r) => r.h, { rows: (a, b) => (a < b ? -1 : 1), cols: (a, b) => (a < b ? 1 : -1) });
    expect(p.rows).toEqual(["Rahul", "Siti"]);
    expect(p.cols).toEqual(["eStore", "Lisa"]);
  });
});

describe("utilisation / budgetBurn", () => {
  it("handles zero capacity", () => {
    expect(utilisation(30, 40)).toBe(0.75);
    expect(utilisation(30, 0)).toBe(0);
  });
  it("classifies burn", () => {
    expect(budgetBurn(10, null).state).toBe("none");
    expect(budgetBurn(10, 0).state).toBe("none");
    expect(budgetBurn(10, 100)).toEqual({ used: 10, budget: 100, ratio: 0.1, state: "ok" });
    expect(budgetBurn(85, 100).state).toBe("warn");
    expect(budgetBurn(120, 100).state).toBe("over");
  });
});

describe("toCsv", () => {
  it("quotes what needs quoting and starts with a BOM", () => {
    const out = toCsv(["a", "b"], [["x,y", 'say "hi"'], [1, null], [undefined, "line\nbreak"]]);
    expect(out.charCodeAt(0)).toBe(0xfeff);
    expect(out.slice(1)).toBe('a,b\r\n"x,y","say ""hi"""\r\n1,\r\n,"line\nbreak"\r\n');
  });
});
