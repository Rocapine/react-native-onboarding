import { describe, it, expect, vi } from "vitest";
import { runActions } from "../elements/runActions";
import type { RenderContext } from "../elements/shared";
import { actionsCanComplete as uiActionsCanComplete } from "../elements/completingActions";
import { actionsCanComplete as headlessActionsCanComplete } from "../../../../../onboarding/src/screens/completingActions";

/**
 * THE ESCAPE WALK AND THE RUNTIME MUST ANSWER THE SAME QUESTION.
 *
 * `completingActions.ts` decides, statically, whether a press is a way OFF the
 * screen; `runActions` decides it at press time by actually running the list.
 * Every bug this PR went through was the two disagreeing — round 1 landed the
 * AND rule in the headless package only, round 2 tightened the walk without
 * moving the runtime — and nothing compared them, because each was tested
 * against its own description of the rule rather than against the other.
 *
 * So this file tests neither in isolation. For a table of `custom` shapes it
 * runs the list under EVERY outcome a host can produce, and asserts:
 *
 *     actionsCanComplete(actions) === (every outcome reaches `complete`)
 *
 * Both directions matter. `true` with an outcome that strands is the #209
 * escape-CTA guard missing a trap; `false` with every outcome completing is the
 * guard bolting a second CTA onto a screen that already had one (review round
 * 2, finding 2).
 *
 * THE OUTCOMES. After the semantics decision on #191 (recorded on the issue,
 * 2026-09-11) there are TWO paths, not three: the handler resolves, or it
 * fails. An unregistered name and a thrown handler are the same failure — both
 * run `onError` and both leave the enclosing list running — so they are
 * asserted to produce identical results here rather than being described as
 * similar. That is decision 2, made structural: a future edit that re-splits
 * them fails this file.
 *
 * The equivalence is asserted over THIS TABLE, not universally: the walk errs
 * toward "no" on shapes it cannot reason about (an unrecognised action, a
 * `renderWhen`-gated CTA), and that conservatism is deliberate.
 */

type Outcome = "resolves" | "throws" | "unregistered";
const OUTCOMES: Outcome[] = ["resolves", "throws", "unregistered"];

const makeCtx = (overrides: Partial<RenderContext> = {}): RenderContext => {
  const variables: Record<string, { value: string; label?: string }> = {};
  return {
    theme: {} as RenderContext["theme"],
    getVariables: () => variables,
    setVariable: (key, entry) => {
      variables[key] = entry;
    },
    onContinue: vi.fn(),
    customActions: {},
    renderChildren: () => null,
    ...overrides,
  } as RenderContext;
};

/** One press against a host that produces `outcome` for every custom handler. */
const press = async (actions: unknown[], outcome: Outcome) => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const onContinue = vi.fn();
  const handler = vi.fn(async () => {
    if (outcome === "throws") throw new Error("boom");
  });
  const ctx = makeCtx({
    onContinue,
    // "unregistered" is spelled by registering nothing at all — `ScreenHost`'s
    // own default, and the reason `onResolve` alone is not an escape.
    customActions: outcome === "unregistered" ? {} : { generatePlan: handler, other: handler },
  });
  await runActions(actions as never, ctx);
  error.mockRestore();
  return { completed: onContinue.mock.calls.length > 0, calls: onContinue.mock.calls.length };
};

const custom = (extra: Record<string, unknown> = {}) => ({
  type: "custom",
  function: "generatePlan",
  ...extra,
});

const TABLE: { name: string; actions: unknown[] }[] = [
  { name: "a bare custom action", actions: [custom()] },
  { name: "the classic [{custom}, continue]", actions: [custom(), "continue"] },
  {
    name: "an escape only on the resolve path",
    actions: [custom({ onResolve: ["continue"] })],
  },
  {
    name: "an escape only on the error path",
    actions: [custom({ onError: ["continue"] })],
  },
  {
    name: "an escape on both paths",
    actions: [custom({ onResolve: ["continue"], onError: ["continue"] })],
  },
  {
    name: "an onError escape plus a trailing continue",
    actions: [custom({ onError: ["continue"] }), "continue"],
  },
  {
    name: "an onResolve escape plus a trailing dismiss",
    actions: [custom({ onResolve: ["continue"] }), { type: "dismiss" }],
  },
  {
    name: "a non-completing hook on both paths",
    actions: [
      custom({
        onResolve: [{ type: "setVariable", name: "ok", value: "1" }],
        onError: [{ type: "setVariable", name: "ko", value: "1" }],
      }),
    ],
  },
  {
    name: "a continue BEFORE the custom action",
    actions: ["continue", custom()],
  },
  {
    name: "a second custom action after the first",
    actions: [custom({ onError: ["continue"] }), { type: "custom", function: "other" }],
  },
  {
    name: "a trailing continue after two custom actions",
    actions: [custom(), { type: "custom", function: "other" }, "continue"],
  },
];

describe("custom: the escape walk agrees with what runActions does", () => {
  for (const { name, actions } of TABLE) {
    it(`${name}`, async () => {
      const results = await Promise.all(OUTCOMES.map((o) => press(actions, o)));
      const everyOutcomeCompletes = results.every((r) => r.completed);
      expect(
        uiActionsCanComplete(actions),
        `walk says ${uiActionsCanComplete(actions)}; outcomes completed: ${OUTCOMES.map(
          (o, i) => `${o}=${results[i].completed}`
        ).join(" ")}`
      ).toBe(everyOutcomeCompletes);
    });
  }

  // The two copies of the walk are the thing a peer-dep range lets drift apart.
  it("both packages' walks agree on every shape in the table", () => {
    for (const { name, actions } of TABLE) {
      expect(headlessActionsCanComplete(actions), name).toBe(uiActionsCanComplete(actions));
    }
  });
});

describe("custom: an unregistered handler takes the same path as a throw", () => {
  // Decision 2. Before it, the two failure modes disagreed with each other —
  // an unregistered name continued the list, a throw aborted it — and nothing
  // in the payload, the schema or the console distinguished them (#266).
  for (const { name, actions } of TABLE) {
    it(`${name}`, async () => {
      const thrown = await press(actions, "throws");
      const missing = await press(actions, "unregistered");
      expect(thrown).toEqual(missing);
    });
  }
});

describe("custom: one press completes the screen at most once", () => {
  // `onError: ["continue"]` beside a trailing `"continue"` is the shape that
  // would double-fire if the recursion stopped propagating its return value:
  // two `router.push`es, or a silently skipped screen in an index-advancing
  // host (#266 names it as the hazard option 2 imports from `purchase`).
  for (const { name, actions } of TABLE) {
    it(`${name}`, async () => {
      for (const outcome of OUTCOMES) {
        const { calls } = await press(actions, outcome);
        expect(calls, `${name} / ${outcome}`).toBeLessThanOrEqual(1);
      }
    });
  }
});
