import { describe, it, expect } from "vitest";
import { ScreenElementsSchema } from "../screens/types";

/**
 * `UIElementSchema` is a DISCRIMINATED union on `type`. As a plain `z.union`
 * of ~27 recursive variants it had to try every branch at every node, with
 * each container branch re-parsing the whole subtree, so any shape that missed
 * on all of them cost exponential time and memory. That produced three
 * CRASHES rather than validation errors — reproduced on a real 52-node paywall
 * before this changed:
 *
 *   - every `id` stripped        → heap OOM, ~10s, dead at 512 MB
 *   - one container missing      → RangeError: Invalid string length, thrown
 *     its `children` key           from JSON.stringify inside zod's own error
 *                                  constructor (the error was too big to build)
 *   - anything else              → returned, but the only readable issue was
 *                                  `invalid_union` / "Invalid input" at the
 *                                  array index
 *
 * These assert the shape of the fix, not the timing: each case must RETURN a
 * failure and name the real path. The generous per-case budget is a canary for
 * a future change that reintroduces backtracking — the pathological cases now
 * complete in single-digit milliseconds, so a breach means the discriminator
 * was lost, not that the machine was slow.
 */

const BUDGET_MS = 2000;

const stack = (id: string, children: unknown[]) => ({
  id,
  name: "container",
  type: "YStack",
  props: {},
  children,
});
const text = (id: string, content: string) => ({ id, type: "Text", props: { content } });

/** A container chain `depth` deep with one leaf at the bottom. */
const nest = (depth: number, leaf: unknown): unknown =>
  depth === 0 ? leaf : stack(`c${depth}`, [nest(depth - 1, leaf)]);

const stripIds = (node: any): any => {
  const { id, children, ...rest } = node;
  return { ...rest, ...(children ? { children: children.map(stripIds) } : {}) };
};

const parse = (elements: unknown) => {
  const started = Date.now();
  const result = ScreenElementsSchema.safeParse(elements);
  return { result, elapsed: Date.now() - started };
};

describe("element union: discriminated on `type`", () => {
  it("still accepts a valid nested tree", () => {
    const { result } = parse([nest(8, text("leaf", "hello"))]);
    expect(result.success).toBe(true);
  });

  it("FAILS rather than exhausting the heap when every `id` is missing", () => {
    // The app-kill vector. `id` is required on every variant, so a missing one
    // misses every branch at every node — which is exactly why "make `id`
    // required and fail fast" could never work inside a plain union.
    const { result, elapsed } = parse([stripIds(nest(10, text("leaf", "hi")))]);
    expect(result.success).toBe(false);
    expect(elapsed).toBeLessThan(BUDGET_MS);
  });

  it("names the missing `id` by path instead of reporting a union miss", () => {
    const { result } = parse([{ name: "no id", type: "Text", props: { content: "x" } }]);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((i) => i.path.join(".") === "0.id")).toBe(true);
  });

  it("FAILS rather than throwing when a container has no `children` key", () => {
    // Previously RangeError from inside zod's error constructor: the error
    // object could not even be built, so nothing could report it.
    const { result, elapsed } = parse([{ id: "a", name: "n", type: "YStack", props: {} }]);
    expect(result.success).toBe(false);
    expect(elapsed).toBeLessThan(BUDGET_MS);
    if (result.success) return;
    expect(result.error.issues[0].path.join(".")).toBe("0.children");
  });

  it("reports an unknown `type` as a discriminator miss naming the valid types", () => {
    const { result } = parse([{ id: "a", type: "NotAnElement", props: {} }]);
    expect(result.success).toBe(false);
    if (result.success) return;
    const [issue] = result.error.issues;
    expect(issue.path.join(".")).toBe("0.type");
    expect(issue.message).toContain("YStack");
    expect(issue.message).toContain("Button");
  });

  it("points at the exact offending prop deep in a tree", () => {
    // The real production case: a Button `variant` outside the enum, which used
    // to surface only as `0: Invalid input`.
    const bad = { id: "b", type: "Button", props: { label: "Go", variant: "plain" } };
    const { result } = parse([nest(6, bad)]);
    expect(result.success).toBe(false);
    if (result.success) return;
    const paths = result.error.issues.map((i) => i.path.join("."));
    expect(paths.some((p) => p.endsWith("props.variant"))).toBe(true);
  });

  it("keeps YStack and XStack as separate variants sharing one props schema", () => {
    // They are two entries because a discriminated union cannot key off a
    // union of literals — a regression here would silently drop XStack.
    expect(parse([stack("y", [])]).result.success).toBe(true);
    expect(parse([{ ...stack("x", []), type: "XStack" }]).result.success).toBe(true);
  });
});
