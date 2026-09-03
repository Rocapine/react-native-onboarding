/**
 * "Can the user still get off this screen?" — the guard the unknown-element
 * strip needs (#209).
 *
 * A ComposableScreen's CTA is authored INSIDE the element tree.
 * `ComposableScreenRenderer` passes no `button` to `OnboardingTemplate`, so
 * `runActions` — reached only from something the user can press in that tree —
 * is the single path to `onContinue`. Drop the element that happens to be the
 * screen's root container and the payload still parses, to `elements: []`: a
 * blank screen with no CTA, and on a `displayProgressHeader: false` step no back
 * chevron either. Stripping would then have replaced a throw that at least
 * reached `componentDidCatch` with a silent dead end, which is worse.
 *
 * So the renderer asks this before it renders a stripped tree, and supplies its
 * own escape when the answer is no — the same choice the two existing
 * boundaries make: an unknown *step* type renders a Continue button
 * (`OnboardingPage`), and a paywall whose elements fail to parse calls
 * `onContinue()` "so the user is not trapped" (`Pages/Paywall/Renderer`).
 *
 * WHAT COUNTS. `runActions` calls `onContinue` for exactly two actions —
 * `"continue"` and `{type:"dismiss"}` — so those two, wherever a press can
 * reach them, are the whole definition. Everything else (`setVariable`,
 * `presentPaywall`, `custom`) leaves the user on the screen as far as this SDK
 * can tell, and is not counted.
 *
 * The walk deliberately errs toward "no": an unrecognised action shape, or a
 * `continue` somewhere the runtime would not actually run it, reads as no way
 * forward. A redundant escape CTA on an already-degraded screen is a cosmetic
 * cost; a missed one is the trap this exists to close.
 *
 * NOT CONSIDERED: `renderWhen`. A CTA the author gated behind a condition may
 * be hidden at runtime, but that is authored intent evaluated against live
 * variables, not something a static payload walk can or should second-guess.
 */

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Element types whose renderer owns its own press handling, so the generic
 * `onPress` from `BaseBoxProps` is never wired for them.
 *
 * Mirrors `PRESS_HANDLED_TYPES` in `renderElement.tsx` — the UI package cannot
 * be imported here, so the two lists are held equal by a source-level test in
 * `packages/onboarding-ui/src/UI/Runtime/__tests__/unknownElementTypes.test.ts`.
 * Counting an ignored `onPress` as a way forward would leave a user trapped on a
 * screen whose only remaining "CTA" the runtime never dispatches.
 */
const PRESS_HANDLED_TYPES: ReadonlySet<string> = new Set([
  "Button",
  "RadioGroup",
  "CheckboxGroup",
  "DatePicker",
  "Input",
  "WheelPicker",
  "DrawingPad",
  "Slider",
]);

/**
 * One action, or any action nested in one of its branch lists
 * (`purchase.onSuccess`, `restore.onNothingToRestore`, …), completes the screen.
 *
 * Branch lists are found by shape rather than by name, so a branch added to
 * `purchase`/`restore` later is covered without a change here.
 */
const isCompletingAction = (action: unknown): boolean => {
  // `ButtonActionSchema` declares continue as the string literal, not an
  // object: `{type:"continue"}` is not an action the runtime runs.
  if (action === "continue") return true;
  if (!isRecord(action)) return false;
  if (action.type === "dismiss") return true;
  return Object.values(action).some(
    (value) => Array.isArray(value) && value.some(isCompletingAction)
  );
};

const nodeCanComplete = (node: unknown): boolean => {
  if (!isRecord(node)) return false;
  const props = isRecord(node.props) ? node.props : undefined;
  if (props) {
    if (props.actions != null) {
      // `Button` reads `actions ?? (action === "continue" ? …)`, so a present
      // `actions` shadows the deprecated shorthand — even when it is empty.
      if (Array.isArray(props.actions) && props.actions.some(isCompletingAction)) return true;
    } else if (props.action === "continue") {
      return true;
    }
    if (
      Array.isArray(props.onPress) &&
      !PRESS_HANDLED_TYPES.has(String(node.type)) &&
      props.onPress.some(isCompletingAction)
    ) {
      return true;
    }
  }
  return Array.isArray(node.children) && node.children.some(nodeCanComplete);
};

/**
 * Whether anything in this element tree can complete the screen.
 *
 * Pure, linear, and total: any malformed input (non-array, `null` nodes,
 * non-record props) answers `false` rather than throwing, because it runs on a
 * payload that has not been parsed yet.
 */
export const hasCompletingAction = (elements: unknown): boolean =>
  Array.isArray(elements) && elements.some(nodeCanComplete);
