#!/usr/bin/env node
// One release, one version number. This asserts every in-repo artifact that
// states it agrees.
//
//   node scripts/check-versions.mjs
//
// The version-mirroring POLICY was never the problem — four artifacts stated the
// same number and drifted anyway, because mirroring was a step someone had to
// remember. The release skill even edited `claude-plugin/.claude-plugin/plugin.json`
// and then staged four files that didn't include it, so the edit was made and
// silently dropped every time. A check is cheaper than remembering.
//
// In scope: the two published packages, the Claude Code plugin manifest, and the
// top entry of each package CHANGELOG.
//
// Out of scope, deliberately:
//   - The root package.json version (1.1.1). The root is `private: true` and
//     publishes nothing, so its version is inert. Left alone rather than dragged
//     into a scheme it plays no part in.
//   - The rocapine-marketplace entry. It lives in another repo, and a required
//     check that reaches across a network boundary fails for reasons that have
//     nothing to do with the pull request in front of it. This script prints the
//     value the marketplace should carry; the release skill turns that into a PR.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const version = (p) => JSON.parse(read(p)).version;

/** The newest released version in a keep-a-changelog file, skipping [Unreleased]. */
function topChangelogVersion(path) {
  for (const line of read(path).split("\n")) {
    const m = /^##\s*\[([^\]]+)\]/.exec(line);
    if (m && !/unreleased/i.test(m[1])) return m[1];
  }
  return null;
}

const sources = [
  ["packages/onboarding/package.json", version("packages/onboarding/package.json")],
  ["packages/onboarding-ui/package.json", version("packages/onboarding-ui/package.json")],
  ["claude-plugin/.claude-plugin/plugin.json", version("claude-plugin/.claude-plugin/plugin.json")],
  ["packages/onboarding/CHANGELOG.md (top entry)", topChangelogVersion("packages/onboarding/CHANGELOG.md")],
  ["packages/onboarding-ui/CHANGELOG.md (top entry)", topChangelogVersion("packages/onboarding-ui/CHANGELOG.md")],
];

const width = Math.max(...sources.map(([label]) => label.length));
for (const [label, v] of sources) {
  console.log(`  ${label.padEnd(width)}  ${v ?? "(none found)"}`);
}
console.log("");

const distinct = [...new Set(sources.map(([, v]) => v))];
if (distinct.length !== 1 || distinct[0] == null) {
  console.error("*** Version identities disagree.");
  console.error("");
  console.error("A release sets all of these to the same number. If you bumped the packages,");
  console.error("the plugin manifest and both CHANGELOG top entries move with them — the");
  console.error("`bump-version` skill does this, and stages all five files.");
  process.exit(1);
}

const agreed = distinct[0];
console.log(`Versions agree: ${agreed}`);
console.log(
  `Marketplace (other repo): Rocapine/rocapine-marketplace .claude-plugin/marketplace.json → ` +
    `the "react-native-onboarding" entry should read "version": "${agreed}".`,
);
console.log(
  `That field is informational — installs track this repo's default branch by commit sha — ` +
    `so it is a follow-up PR, never a release blocker.`,
);
