/**
 * Semantic version bumping derived from Conventional Commits.
 * The pipeline feeds commit subjects + bodies since the last tag; the bump is computed, never typed.
 */

export type Bump = "major" | "minor" | "patch" | "none";

export interface Commit {
  subject: string;
  body?: string;
}

const HEADER = /^(?<type>[a-z]+)(?:\((?<scope>[^)]*)\))?(?<bang>!)?:\s/i;

/** Classify a single commit. Unknown/non-conventional commits count as no bump. */
export function classifyCommit(c: Commit): Bump {
  const m = HEADER.exec(c.subject);
  const body = c.body ?? "";
  const breakingFooter = /(^|\n)BREAKING[ -]CHANGE:/m.test(body);
  if (!m) return breakingFooter ? "major" : "none";
  const type = (m.groups?.type ?? "").toLowerCase();
  if (m.groups?.bang || breakingFooter) return "major";
  if (type === "feat") return "minor";
  if (type === "fix" || type === "perf" || type === "revert") return "patch";
  // Schema migrations that drop/rename columns are breaking by policy.
  if (type === "migration" && /\b(drop|rename)\b/i.test(c.subject + body)) return "major";
  return "none";
}

const RANK: Record<Bump, number> = { none: 0, patch: 1, minor: 2, major: 3 };

export function highestBump(commits: Commit[]): Bump {
  return commits.reduce<Bump>((acc, c) => {
    const b = classifyCommit(c);
    return RANK[b] > RANK[acc] ? b : acc;
  }, "none");
}

export function parseVersion(v: string): [number, number, number] {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
  if (!m) throw new Error(`Invalid semver: ${v}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function applyBump(version: string, bump: Bump): string {
  const [maj, min, pat] = parseVersion(version);
  switch (bump) {
    case "major":
      return `${maj + 1}.0.0`;
    case "minor":
      return `${maj}.${min + 1}.0`;
    case "patch":
      return `${maj}.${min}.${pat + 1}`;
    case "none":
      return `${maj}.${min}.${pat}`;
  }
}

/** Convenience: next version for a set of commits since `current`. */
export function nextVersion(current: string, commits: Commit[]): { version: string; bump: Bump } {
  const bump = highestBump(commits);
  return { version: applyBump(current, bump), bump };
}
