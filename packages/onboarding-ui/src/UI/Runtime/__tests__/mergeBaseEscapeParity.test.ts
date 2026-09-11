import { describe, it, expect, vi } from "vitest";
import { runActions } from "../elements/runActions";
import type { RenderContext } from "../elements/shared";
import { actionsCanComplete as uiActionsCanComplete } from "../elements/completingActions";
import {
  actionsCanComplete as headlessActionsCanComplete,
  hasCompletingAction,
} from "../../../../../onboarding/src/screens/completingActions";
import { resolveRenderableStep } from "../../../../../onboarding/src/screens/resolveRenderableStep";

/**
 * PAYLOAD SHAPES THAT PREDATE #191 MUST STILL BEHAVE AS THEY DID AT ITS MERGE
 * BASE (`cb4a7d5`).
 *
 * Every assertion here is a MEASURED base behaviour, not a paraphrase of one:
 * this file runs unchanged against a `cb4a7d5` checkout, which is how each row
 * was obtained. That is the check the #191 review rounds did not have — the
 * `custom`-as-barrier rule was refined twice (`f8e2cca`, then `f787f47` /
 * `59c87b5`) and survived two verify passes and two review lenses while
 * silently changing the answer for the only `custom` shape Studio can author
 * today. Adding a rule about `custom` is fine; changing what an EXISTING
 * payload does is the thing that needs to be deliberate, and nothing compared
 * the two.
 *
 * The shape in question is `[{custom}, "continue"]`. It is what an author
 * writes when the CTA has to fire a host handler and then move on, and it is
 * all they CAN write: Studio's action editor cannot spell `onResolve` /
 * `onError` until `rocapine/onboarding-studio#288` lands, so the corrective
 * advice ("declare `onError`") is not yet available to anybody whose payload is
 * already in the field.
 *
 * Deliberate divergences from the base live elsewhere on purpose — see
 * `packages/onboarding/src/__tests__/customActionHooks.test.ts`, where
 * `{custom, onResolve: ["continue"]}` alone is asserted NOT to be a way off the
 * screen (that one IS #191's headline, and it is a change from the base). This
 * file holds only what must not have moved, so it stays runnable against
 * `cb4a7d5` verbatim.
 */

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

/**
 * Round 2 finding 1 (high). The rescue path `runActions` takes when the build
 * cannot ask for a permission at all and the author declared no
 * `onUnavailable`: it asks `completingActionKind` whether the press was the
 * screen's way forward, over the ask's two outcome branches CONCATENATED.
 *
 * A `custom` anywhere in `onGranted` then made the walk read everything after
 * it — including the whole of `onDenied`, a branch that never runs in the same
 * press — as that action's `rest`, and refused the lot for want of an
 * `onError`. Measured: 1 `onContinue` call at `cb4a7d5`, 0 at `c613816`, with a
 * single `console.error` and a user with no CTA and no back chevron.
 */
describe("the unavailable-permission rescue still fires (merge base cb4a7d5)", () => {
  const ask = (kind: string, extra: Record<string, unknown> = {}) =>
    ({ type: "requestPermission", kind, ...extra }) as never;

  it("completes when a custom in onGranted sits beside a plain continue in onDenied", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const onContinue = vi.fn();
    await runActions(
      [
        ask("notifications", {
          onGranted: [{ type: "custom", function: "registerPushToken" }],
          onDenied: ["continue"],
        }),
      ],
      makeCtx({ onContinue })
    );
    expect(onContinue).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it("completes when the grant branch itself is a custom followed by a continue", async () => {
    // The realistic authoring of the same screen: fire the handler, then move
    // on, whichever way the user answered.
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const onContinue = vi.fn();
    await runActions(
      [
        ask("notifications", {
          onGranted: [{ type: "custom", function: "registerPushToken" }, "continue"],
          onDenied: ["continue"],
        }),
      ],
      makeCtx({ onContinue })
    );
    expect(onContinue).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
});

/**
 * Round 2 finding 2 (medium). The #209 escape-CTA guard read the same classic
 * shape as "no way off this screen", so a stripped screen whose surviving CTA
 * is `[{custom}, "continue"]` got a SECOND Continue button bolted on by
 * `OnboardingTemplate` plus a `console.error` naming a trap that is not one.
 */
describe("the classic [{custom}, \"continue\"] CTA is a way off the screen (merge base cb4a7d5)", () => {
  const cta = (actions: unknown[]) => [
    { id: "cta", type: "Button", props: { label: "Generate", actions } },
  ];
  const classic = [{ type: "custom", function: "generatePlan" }, "continue"];

  it("counts as a completing action in an element tree", () => {
    expect(hasCompletingAction(cta(classic))).toBe(true);
  });

  it("counts in both packages' per-list walk", () => {
    expect(headlessActionsCanComplete(classic)).toBe(true);
    expect(uiActionsCanComplete(classic)).toBe(true);
  });

  it("does not make a stripped screen ask for an escape CTA of its own", () => {
    // The blast radius, stated as the thing a user sees: an app that does not
    // know `Lottie` drops it, the authored Button survives, and the screen must
    // render ONE CTA — not the author's plus the template's.
    const step = {
      id: "s1",
      name: "Generate",
      type: "ComposableScreen",
      displayProgressHeader: true,
      payload: {
        elements: [
          { id: "anim", type: "Lottie", props: {} },
          ...cta(classic),
        ],
      },
    };
    const resolved = resolveRenderableStep(step, new Set(["Button"]));
    expect(resolved.omitted.map((o) => o.elementType)).toEqual(["Lottie"]);
    expect(resolved.needsEscape).toBe(false);
  });
});
