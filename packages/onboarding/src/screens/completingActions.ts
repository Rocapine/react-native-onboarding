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
 * reach them, are the whole definition. Two exceptions to "wherever":
 * `requestPermission` and `custom` are read with AND across their outcome hooks
 * rather than OR (see `permissionAskCompletes` and `customActionEscapes`),
 * because neither a grant nor a backend's answer is the user's to give — a
 * `"continue"` sitting only in `onGranted`/`onResolve` strands everyone on the
 * other branch. Everything else (`setVariable`, `presentPaywall`) leaves the
 * user on the screen as far as this SDK can tell, and is not counted.
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
 * WHICH completing action a press can reach, not just whether it can reach one.
 *
 * `runActions` needs the kind, not the boolean: when it stands in for an ask
 * whose module is missing it has to call `complete` the way the AUTHOR'S OWN
 * escape would have (review round 2, finding 1 — a bare `onContinue()` walked
 * the user through a hard paywall gate that the authored `{dismiss}` would have
 * held shut). One walk answers both questions, so the two cannot disagree.
 */
export type EscapeAction = "continue" | "dismiss";

const union = (...sets: ReadonlySet<EscapeAction>[]): Set<EscapeAction> => {
  const out = new Set<EscapeAction>();
  for (const s of sets) for (const v of s) out.add(v);
  return out;
};

/**
 * Every completing action reachable through one list — directly, or nested in
 * one of an action's branch lists (`purchase.onSuccess`,
 * `restore.onNothingToRestore`, …).
 *
 * Branch lists are found by shape rather than by name, so a branch added to
 * `purchase`/`restore` later is covered without a change here.
 */
const listEscapes = (value: unknown): Set<EscapeAction> => {
  if (!Array.isArray(value)) return new Set<EscapeAction>();
  const before = new Set<EscapeAction>();
  for (let i = 0; i < value.length; i++) {
    const action = value[i];
    // `custom` is a BARRIER, not just another item: the throw path returns
    // false from `runActions`, so what follows it in the SAME list is reachable
    // on only two of the action's three paths and has to be weighed against
    // them, not counted on its own. It is handed on as `rest` for
    // `customActionEscapes` to place. Everything BEFORE the barrier does run,
    // and a completing action there returns before the handler is ever called,
    // so those keep the plain OR reading.
    if (isRecord(action) && action.type === "custom") {
      return union(before, customActionEscapes(action, value.slice(i + 1)));
    }
    for (const escape of actionEscapes(action)) before.add(escape);
  }
  return before;
};

const listCompletes = (value: unknown): boolean => listEscapes(value).size > 0;

/**
 * `requestPermission` is the one action read with AND rather than OR, because
 * its outcome is not the user's to choose.
 *
 * `runActions` has exactly three paths: a grant runs `onGranted`, a refusal
 * runs `onDenied`, and "this build cannot ask" runs `onUnavailable` when
 * declared. All of them have to reach a `"continue"` / `{dismiss}` for the ask
 * to be a way OFF the screen — a CTA whose only `"continue"` sits in
 * `onGranted` strands everyone who refuses.
 *
 * The third path is the one the runtime rescues by itself: with no
 * `onUnavailable` declared it completes the screen rather than running
 * `onDenied` (review round 1 of #196 — the old fallback recorded a refusal the
 * user was never asked for, and rescued nobody when `onDenied` was absent too).
 * So a declared-but-dead `onUnavailable` still reads as a trap here, while its
 * ABSENCE no longer does.
 *
 * `purchase` / `restore` keep the generic OR reading on purpose: a cancelled
 * purchase leaves the user free to press again, whereas a standing OS denial is
 * final for the life of the install. Not symmetric, so not shared.
 *
 * Mirrors the runtime's own shape (`runActions.ts` — `onUnavailable` present but
 * empty runs nothing, exactly as an empty array does here).
 */
const permissionAskEscapes = (
  action: Record<string, unknown>
): Set<EscapeAction> => {
  const onGranted = listEscapes(action.onGranted);
  const onDenied = listEscapes(action.onDenied);
  // Absent `onUnavailable`: the runtime completes the screen itself iff the
  // author put a completing action somewhere in the ask — the same
  // `actionsCanComplete(onGranted) || actionsCanComplete(onDenied)` test
  // `runActions` runs. Written out rather than folded into the conjunction
  // below, so this stays readable as the runtime's three paths.
  const onUnavailable = action.onUnavailable
    ? listEscapes(action.onUnavailable)
    : union(onGranted, onDenied);
  if (!onGranted.size || !onDenied.size || !onUnavailable.size)
    return new Set<EscapeAction>();
  return union(onGranted, onDenied, onUnavailable);
};

const permissionAskCompletes = (action: Record<string, unknown>): boolean =>
  permissionAskEscapes(action).size > 0;

/**
 * `custom` is the second AND-read action, for the same reason (#191, review
 * round 1, finding 6): its outcome is the service's, not the user's.
 *
 * `runActions` has three paths, and `rest` — whatever follows the action in the
 * same list — is reachable from two of them:
 *
 *  - the handler RESOLVES: `onResolve` runs, then `rest`;
 *  - NO HANDLER is registered: it logs, runs `onError`, then `rest`;
 *  - the handler THROWS with every retry spent: `onError` runs and the list
 *    ABORTS (`return false`), so `rest` never runs.
 *
 * **The conjunction is over the first two — the paths that leave the list
 * running — not all three.** So the escape set is `onResolve ∪ rest` AND
 * `onError ∪ rest`, both non-empty.
 *
 * WHY THE THROW PATH IS NOT A TERM. It is the one outcome the user can talk out
 * of: the retries are spent for THIS press, the CTA is still on screen, the
 * single-flight claim is released (`Runtime/inFlight.ts`), and pressing again
 * starts a fresh `retry.maxAttempts`. That is exactly the reason `purchase` and
 * `restore` keep the generic OR reading — a store that failed once may succeed
 * on the next tap, unlike a standing OS permission denial, which is final for
 * the life of the install. A missing handler is NOT retryable in that sense (the
 * build simply does not wire that name, so every press does the same nothing),
 * which is why `onError ∪ rest` stays a term.
 *
 * Requiring `onError` on its own is what round 2 of this PR shipped, and it read
 * `[{custom}, "continue"]` as "no way off this screen" — the shape an author
 * writes when the CTA fires a handler and then moves on, and the ONLY `custom`
 * shape Studio can author until `rocapine/onboarding-studio#288` lands. Every
 * such payload already in the field got a duplicate escape CTA bolted onto any
 * screen that had also been stripped, plus a `console.error` naming a trap that
 * is not one. Pinned by
 * `onboarding-ui/src/UI/Runtime/__tests__/mergeBaseEscapeParity.test.ts`, which
 * runs verbatim against this PR's merge base.
 *
 * What round 1, finding 6 established SURVIVES: a `"continue"` in `onResolve`
 * alone is still not a way off the screen, because the unregistered-handler path
 * is then empty — and `customActions: {}` is `ScreenHost`'s own default, so that
 * is not a hypothetical host.
 */
const customActionEscapes = (
  action: Record<string, unknown>,
  rest: readonly unknown[] = []
): Set<EscapeAction> => {
  const afterwards = listEscapes(rest);
  const resolved = union(listEscapes(action.onResolve), afterwards);
  const unregistered = union(listEscapes(action.onError), afterwards);
  if (!resolved.size || !unregistered.size) return new Set<EscapeAction>();
  return union(resolved, unregistered);
};

const actionEscapes = (action: unknown): Set<EscapeAction> => {
  // `ButtonActionSchema` declares continue as the string literal, not an
  // object: `{type:"continue"}` is not an action the runtime runs.
  if (action === "continue") return new Set<EscapeAction>(["continue"]);
  if (!isRecord(action)) return new Set<EscapeAction>();
  if (action.type === "dismiss") return new Set<EscapeAction>(["dismiss"]);
  if (action.type === "requestPermission") return permissionAskEscapes(action);
  if (action.type === "custom") return customActionEscapes(action);
  return union(...Object.values(action).map(listEscapes));
};

const nodeCanComplete = (node: unknown): boolean => {
  if (!isRecord(node)) return false;
  const props = isRecord(node.props) ? node.props : undefined;
  if (props) {
    if (props.actions != null) {
      // `Button` reads `actions ?? (action === "continue" ? …)`, so a present
      // `actions` shadows the deprecated shorthand — even when it is empty.
      //
      // Read as ONE list, not action-by-action: order matters, because a
      // `custom` action aborts the list on its throw path, so an action before
      // it is unconditional while one after it is reachable on only two of the
      // three paths. `.some(isCompletingAction)` could express neither, and
      // credited a `"continue"` inside an `onResolve` hook it never looked at
      // the reachability of at all.
      if (listCompletes(props.actions)) return true;
    } else if (props.action === "continue") {
      return true;
    }
    if (
      !PRESS_HANDLED_TYPES.has(String(node.type)) &&
      listCompletes(props.onPress)
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

/**
 * The same walk over ONE action list rather than a whole element tree.
 *
 * Exists for the runtime, which needs the question answered at press time and
 * had been deciding it by hand: `runActions` reaches "the build cannot ask for
 * this permission and the author declared no `onUnavailable`" and has to choose
 * between logging and moving on, and stranding the user. Whether the press was
 * the screen's only way forward is exactly what this module already knows, so
 * the runtime consults it instead of re-deriving it (review round 1, finding 1).
 *
 * OR across the list — "did the author intend this press to move the user on" —
 * not `permissionAskCompletes`' AND across one ask's outcomes, which answers the
 * stricter "does EVERY outcome move them on". Total on junk for the same reason
 * `hasCompletingAction` is.
 */
export const actionsCanComplete = (actions: unknown): boolean => listCompletes(actions);

/**
 * WHICH completing action stands in for a press list — the kind, where
 * `actionsCanComplete` gives only the yes/no.
 *
 * `"dismiss"` wins when the list can reach both, and that preference is the
 * whole reason this exists (review round 2, finding 1). The runtime calls it
 * for one case: a `requestPermission` on a build that cannot ask, with no
 * `onUnavailable` declared. Nobody was asked anything, so the SDK must not
 * claim the more permissive of the two answers the author authored — and the
 * two are not equivalent downstream. `complete()` with no outcome is what
 * `Pages/Paywall/Renderer`'s hard gate reads as "advance"
 * (`shouldAdvanceOnComplete(undefined) === true`), so substituting it for an
 * authored `{dismiss}` handed out paid content to a user who never purchased.
 * `{status:"dismissed"}` is ignored by an onboarding step (it still advances)
 * and resolves a `present()`ed paywall, so preferring it costs nothing on the
 * surfaces where both outcomes mean the same thing, and holds the gate on the
 * one where they do not.
 *
 * `undefined` = this list was never a way off the screen; the runtime then
 * leaves the user where they are rather than inventing an exit.
 */
export const completingActionKind = (
  actions: unknown
): EscapeAction | undefined => {
  const escapes = listEscapes(actions);
  if (escapes.has("dismiss")) return "dismiss";
  if (escapes.has("continue")) return "continue";
  return undefined;
};
