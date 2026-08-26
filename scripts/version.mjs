#!/usr/bin/env node
// Derive the next semantic version from Conventional Commits since the last tag. Never typed by hand.
import { execSync } from "node:child_process";
import { nextVersion } from "../packages/core/src/semver.ts";

const sh = (c) => execSync(c, { encoding: "utf8" }).trim();
let lastTag = "v0.0.0";
try {
  lastTag = sh("git describe --tags --abbrev=0 --match 'v*'");
} catch {}
const range = lastTag === "v0.0.0" ? "" : `${lastTag}..HEAD`;
const raw = sh(`git log ${range} --format=%s%x1f%b%x1e`);
const commits = raw
  .split("\x1e")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => {
    const [subject, body] = s.split("\x1f");
    return { subject: subject ?? "", body: body ?? "" };
  });
const { version, bump } = nextVersion(lastTag.replace(/^v/, ""), commits);
process.stderr.write(`${lastTag} + ${commits.length} commits → ${bump} → ${version}\n`);
process.stdout.write(version);
