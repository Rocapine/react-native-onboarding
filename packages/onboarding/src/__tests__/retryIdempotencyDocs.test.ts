import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * `retry` re-invokes the SAME host handler with the same press-time variables,
 * up to ten times, and a timed-out attempt is an ordinary failed attempt — so a
 * handler that POSTs is asked to POST again, including after an attempt that
 * reached the server and lost only the ANSWER to the clock. Neither the schema,
 * the runtime nor the console can tell a safe handler from an unsafe one, which
 * leaves the prose as the only place the hazard can be stated — and until this
 * test, `grep -i idempoten` over the retry docs returned nothing (review round 2
 * of !263, finding 5).
 *
 * Declared rather than discovered, like `SURFACES` in
 * `scripts/check-element-docs.mjs`: the `maxAttempts` assertion fails if a file
 * stops teaching retry, so the list cannot quietly go stale in either
 * direction. Deliberately NOT here: `Runtime/elements/runActions.ts` (the
 * implementation, not an authoring surface) and the example payloads.
 */
const RETRY_SURFACES = [
  "packages/onboarding/src/steps/common.types.ts",
  "packages/onboarding-ui/src/UI/Runtime/elements/actions.ts",
  "website/docs/customization/custom-actions.mdx",
  "website/docs/page-types.mdx",
  "claude-plugin/skills/validate-step-json/SKILL.md",
  "claude-plugin/skills/compose-screen-builder/SKILL.md",
  "claude-plugin/agents/step-json-reviewer.md",
];

const ROOT = join(__dirname, "../../../..");

/**
 * The warning has to sit WITH the retry teaching, not merely somewhere in the
 * file: `common.types.ts` already says "idempotent" ~280 lines away, about
 * `requestPermission` and the OS's prompt, and a whole-file check passed on that
 * sentence while the retry doc itself said nothing. So the region checked is the
 * span of the file's `maxAttempts` mentions, widened by this much either side.
 */
const REGION_MARGIN = 1500;

describe("retry docs — every surface that teaches `retry` warns it re-runs the handler", () => {
  it.each(RETRY_SURFACES)("%s", (rel) => {
    const src = readFileSync(join(ROOT, rel), "utf8");
    const first = src.indexOf("maxAttempts");
    expect(first, `${rel} no longer teaches retry — drop it from RETRY_SURFACES`).toBeGreaterThan(
      -1
    );
    const region = src
      .slice(Math.max(0, first - REGION_MARGIN), src.lastIndexOf("maxAttempts") + REGION_MARGIN)
      .toLowerCase();
    expect(
      region,
      `${rel} teaches retry without saying the handler must be idempotent`
    ).toContain("idempot");
  });
});
