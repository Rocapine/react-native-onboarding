/**
 * "Was this press a way OFF the screen?" — for one action list.
 *
 * UI mirror of the headless `actionsCanComplete`
 * (`packages/onboarding/src/screens/completingActions.ts`), re-declared here
 * per the mirror rule and held equal by
 * `__tests__/requestPermission.test.ts`, which feeds both implementations the
 * same payload table.
 *
 * Why a mirror rather than importing the headless one:
 *
 *  - The two packages are joined by a peer-dependency RANGE, so a host can
 *    legitimately resolve different versions of them. Keying what this
 *    package's runtime DOES on the other package's installed implementation is
 *    the mistake `__tests__/unknownElementTypes.test.ts` (2) exists to prevent.
 *  - This is a leaf module — no `react-native`, no zod — so it stays importable
 *    from the Node test suite. `runActions.ts` is under test; the headless
 *    package index is not importable there at all (its `dist/index.js` pulls in
 *    Flow-typed `react-native`), so a runtime import of it would take
 *    `runActions`' whole suite offline.
 *
 * `runActions` consults it for exactly one decision: a `requestPermission`
 * whose build cannot ask at all with no `onUnavailable` declared. If the author
 * put a completing action in the ask, that press was the way forward and the
 * runtime completes the screen rather than leaving the user on a screen with no
 * CTA (review round 1 of #196, finding 1).
 */

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** The two actions that reach `complete`, and the OUTCOME each reports. */
export type EscapeAction = "continue" | "dismiss";

const union = (...sets: ReadonlySet<EscapeAction>[]): Set<EscapeAction> => {
  const out = new Set<EscapeAction>();
  for (const s of sets) for (const v of s) out.add(v);
  return out;
};

const listEscapes = (value: unknown): Set<EscapeAction> => {
  if (!Array.isArray(value)) return new Set<EscapeAction>();
  const before = new Set<EscapeAction>();
  for (let i = 0; i < value.length; i++) {
    const action = value[i];
    // A `custom` action is a barrier: `runActions` returns false from its throw
    // path, so nothing after it in the same list runs. Mirror of the headless
    // walk — see the original for the full reasoning.
    if (isRecord(action) && action.type === "custom") {
      return union(before, customActionEscapes(action, value.slice(i + 1)));
    }
    for (const escape of actionEscapes(action)) before.add(escape);
  }
  return before;
};

/**
 * `requestPermission` is read with AND across its outcomes, not OR: its result
 * is not the user's to choose, so it counts as a way forward only when a grant
 * AND a refusal both reach a terminal action. See the headless original for the
 * full reasoning — and note this is only reached for an ask NESTED inside
 * another action's hook, since `runActions` asks about the hook lists.
 */
const permissionAskEscapes = (action: Record<string, unknown>): Set<EscapeAction> => {
  const onGranted = listEscapes(action.onGranted);
  const onDenied = listEscapes(action.onDenied);
  const onUnavailable = action.onUnavailable
    ? listEscapes(action.onUnavailable)
    : union(onGranted, onDenied);
  if (!onGranted.size || !onDenied.size || !onUnavailable.size)
    return new Set<EscapeAction>();
  return union(onGranted, onDenied, onUnavailable);
};

/**
 * `custom` is read with AND across its outcomes too, and its throw path ABORTS
 * the enclosing list (#191, review round 1 finding 6 / round 2 finding 5).
 *
 * `onResolve ∪ rest` covers the resolve path and `onError` covers the throw
 * path; both must be non-empty, which makes the unregistered-handler path
 * (`onError ∪ rest`) non-empty as well. Mirror of the headless
 * `customActionEscapes` — round 1 landed the rule in the headless package only,
 * so the two disagreed about whether this PR's own async-gate shape was a way
 * off the screen, and `runActions` advanced past a screen the strip called a
 * trap.
 */
const customActionEscapes = (
  action: Record<string, unknown>,
  rest: readonly unknown[] = []
): Set<EscapeAction> => {
  const afterwards = listEscapes(rest);
  const onResolve = union(listEscapes(action.onResolve), afterwards);
  const onError = listEscapes(action.onError);
  if (!onResolve.size || !onError.size) return new Set<EscapeAction>();
  return union(onResolve, onError);
};

function actionEscapes(action: unknown): Set<EscapeAction> {
  // `"continue"` is the string literal; `{type:"continue"}` is not an action
  // this runtime runs, so it is not a way forward either.
  if (action === "continue") return new Set<EscapeAction>(["continue"]);
  if (!isRecord(action)) return new Set<EscapeAction>();
  if (action.type === "dismiss") return new Set<EscapeAction>(["dismiss"]);
  if (action.type === "requestPermission") return permissionAskEscapes(action);
  if (action.type === "custom") return customActionEscapes(action);
  return union(...Object.values(action).map(listEscapes));
}

/** Total on junk — it decides whether a user is about to be trapped. */
export const actionsCanComplete = (actions: unknown): boolean =>
  listEscapes(actions).size > 0;

/**
 * WHICH completing action stands in for the list, `"dismiss"` winning when both
 * are reachable. Mirror of the headless `completingActionKind`; the preference
 * is the fix for review round 2, finding 1 — see the headless original for why
 * substituting a bare advance for an authored `{dismiss}` let a module-less
 * build walk a user through a hard paywall gate.
 */
export const completingActionKind = (actions: unknown): EscapeAction | undefined => {
  const escapes = listEscapes(actions);
  if (escapes.has("dismiss")) return "dismiss";
  if (escapes.has("continue")) return "continue";
  return undefined;
};
