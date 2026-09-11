import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The UI package re-declares its own Zod schemas for every ButtonAction, and
// TypeScript catches drift in NEITHER direction: a field added only to the UI
// mirror still throws `invalid_union`, because the headless schema is what
// validates the payload; a field added only to the headless schema parses but
// the renderer never reads it. Both directions have shipped before, which is
// why this reads the two sources off disk and compares them.
//
// Same technique as `unknownElementTypes.test.ts` (a source-level invariant the
// type system cannot express). It is a RELEASE-time check — an installed app
// can resolve a headless version different from its UI package.

const ROOT = join(__dirname, "../../../../../..");
const HEADLESS = join(ROOT, "packages/onboarding/src/steps/common.types.ts");
const MIRROR = join(ROOT, "packages/onboarding-ui/src/UI/Runtime/elements/actions.ts");

/** Slice the balanced `{…}` of the first `z.object(` at or after `from`. */
const objectBody = (src: string, from: number): string => {
  const call = src.indexOf("z.object(", from);
  const start = src.indexOf("{", call);
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(start + 1, i);
  }
  throw new Error("unbalanced z.object block");
};

/** Top-level `key:` names inside a schema body, comments stripped. */
const schemaKeys = (file: string, schemaName: string): string[] => {
  const src = readFileSync(file, "utf8");
  const at = src.indexOf(`export const ${schemaName}`);
  expect(at, `${schemaName} not found in ${file}`).toBeGreaterThan(-1);
  const body = objectBody(src, at)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  const keys: string[] = [];
  let depth = 0;
  for (const line of body.split("\n")) {
    const m = /^\s*([A-Za-z_$][\w$]*)\s*:/.exec(line);
    if (m && depth === 0) keys.push(m[1]);
    for (const ch of line) {
      if (ch === "{" || ch === "[" || ch === "(") depth++;
      else if (ch === "}" || ch === "]" || ch === ")") depth--;
    }
  }
  return keys.sort();
};

describe("ButtonAction schemas: headless and UI mirror agree", () => {
  for (const schema of [
    "CustomButtonActionSchema",
    "SetVariableButtonActionSchema",
    "PurchaseButtonActionSchema",
    "RestoreButtonActionSchema",
    "PresentPaywallButtonActionSchema",
  ]) {
    it(`${schema} declares the same fields in both packages`, () => {
      expect(schemaKeys(MIRROR, schema)).toEqual(schemaKeys(HEADLESS, schema));
    });
  }

  it("CustomActionRetrySchema declares the same fields in both packages", () => {
    expect(schemaKeys(MIRROR, "CustomActionRetrySchema")).toEqual(
      schemaKeys(HEADLESS, "CustomActionRetrySchema")
    );
  });

  // Pins the #191 fields specifically, so a future "tidy-up" that drops them
  // from both sides at once fails here rather than passing an equality check.
  it("custom carries its outcome hooks and retry cap", () => {
    expect(schemaKeys(HEADLESS, "CustomButtonActionSchema")).toEqual([
      "function",
      "onError",
      "onResolve",
      "retry",
      "type",
      "variables",
    ]);
  });
});
