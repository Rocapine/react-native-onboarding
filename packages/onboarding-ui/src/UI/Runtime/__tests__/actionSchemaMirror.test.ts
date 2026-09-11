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

/**
 * Every `*ButtonActionSchema` the headless package declares, DISCOVERED rather
 * than listed (review round 1, finding 11).
 *
 * The round-1 version of this guard hardcoded five names and its header claimed
 * to cover "every ButtonAction" — it silently omitted
 * `RequestPermissionButtonActionSchema` (landed days earlier in #260, and the
 * one variant with three nested hook lists) and `DismissButtonActionSchema`. A
 * later `onTimeout` added to the headless ask and missed in the mirror would
 * have been stripped at parse — the mirror is what `Pages/ComposableScreen/
 * Renderer` parses with — and this file would still have passed.
 *
 * `ButtonActionSchema` itself is excluded: it is the union, not an object.
 */
const actionSchemaNames = (file: string): string[] => {
  const src = readFileSync(file, "utf8");
  return [...src.matchAll(/export const (\w+ButtonActionSchema)\b/g)]
    .map((m) => m[1])
    .filter((name) => name !== "ButtonActionSchema")
    .sort();
};

/** The string members of an `as const` array literal, e.g. PERMISSION_KINDS. */
const constArrayMembers = (file: string, name: string): string[] => {
  const src = readFileSync(file, "utf8");
  const at = src.indexOf(`export const ${name}`);
  expect(at, `${name} not found in ${file}`).toBeGreaterThan(-1);
  const open = src.indexOf("[", at);
  const close = src.indexOf("]", open);
  return [...src.slice(open, close).matchAll(/"([^"]+)"/g)].map((m) => m[1]);
};

describe("ButtonAction schemas: headless and UI mirror agree", () => {
  const headlessSchemas = actionSchemaNames(HEADLESS);

  it("the mirror declares every action schema the headless package does", () => {
    expect(headlessSchemas.length).toBeGreaterThanOrEqual(7);
    expect(actionSchemaNames(MIRROR)).toEqual(headlessSchemas);
  });

  for (const schema of headlessSchemas) {
    it(`${schema} declares the same fields in both packages`, () => {
      expect(schemaKeys(MIRROR, schema)).toEqual(schemaKeys(HEADLESS, schema));
    });
  }

  it("CustomActionRetrySchema declares the same fields in both packages", () => {
    expect(schemaKeys(MIRROR, "CustomActionRetrySchema")).toEqual(
      schemaKeys(HEADLESS, "CustomActionRetrySchema")
    );
  });

  // Both packages re-declare the kind list; a kind in one only fails
  // `invalid_union` against the other.
  it("PERMISSION_KINDS is the same list in both packages", () => {
    expect(constArrayMembers(MIRROR, "PERMISSION_KINDS")).toEqual(
      constArrayMembers(HEADLESS, "PERMISSION_KINDS")
    );
  });

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
