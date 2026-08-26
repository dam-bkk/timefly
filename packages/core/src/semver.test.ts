import { describe, expect, it } from "vitest";
import { applyBump, classifyCommit, highestBump, nextVersion, parseVersion } from "./semver";

describe("classifyCommit", () => {
  it("maps conventional types", () => {
    expect(classifyCommit({ subject: "feat(tickets): saved views" })).toBe("minor");
    expect(classifyCommit({ subject: "fix: sla clock off by one" })).toBe("patch");
    expect(classifyCommit({ subject: "perf: index legacy refs" })).toBe("patch");
    expect(classifyCommit({ subject: "revert: feat x" })).toBe("patch");
    expect(classifyCommit({ subject: "chore: bump deps" })).toBe("none");
    expect(classifyCommit({ subject: "docs: readme" })).toBe("none");
  });
  it("detects breaking changes by bang and footer", () => {
    expect(classifyCommit({ subject: "feat!: drop v1 api" })).toBe("major");
    expect(classifyCommit({ subject: "fix: x", body: "BREAKING CHANGE: session format" })).toBe("major");
    expect(classifyCommit({ subject: "random message", body: "BREAKING-CHANGE: yes" })).toBe("major");
  });
  it("treats destructive migrations as breaking", () => {
    expect(classifyCommit({ subject: "migration: drop column tickets.legacy" })).toBe("major");
    expect(classifyCommit({ subject: "migration: add index" })).toBe("none");
  });
  it("ignores non-conventional messages", () => {
    expect(classifyCommit({ subject: "WIP" })).toBe("none");
  });
});

describe("highestBump / applyBump / nextVersion", () => {
  it("picks the highest", () => {
    expect(highestBump([{ subject: "fix: a" }, { subject: "feat: b" }, { subject: "chore: c" }])).toBe("minor");
    expect(highestBump([])).toBe("none");
  });
  it("applies bumps", () => {
    expect(applyBump("1.4.2", "patch")).toBe("1.4.3");
    expect(applyBump("v1.4.2", "minor")).toBe("1.5.0");
    expect(applyBump("1.4.2", "major")).toBe("2.0.0");
    expect(applyBump("1.4.2", "none")).toBe("1.4.2");
  });
  it("parses and rejects versions", () => {
    expect(parseVersion(" v0.1.0 ")).toEqual([0, 1, 0]);
    expect(() => parseVersion("1.2")).toThrow();
  });
  it("computes next version", () => {
    expect(nextVersion("0.9.9", [{ subject: "feat!: v1" }])).toEqual({ version: "1.0.0", bump: "major" });
  });
});
