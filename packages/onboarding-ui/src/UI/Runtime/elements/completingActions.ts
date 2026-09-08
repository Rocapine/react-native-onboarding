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

const listCompletes = (value: unknown): boolean =>
  Array.isArray(value) && value.some(isCompletingAction);

/**
 * `requestPermission` is read with AND across its outcomes, not OR: its result
 * is not the user's to choose, so it counts as a way forward only when a grant
 * AND a refusal both reach a terminal action. See the headless original for the
 * full reasoning — and note this is only reached for an ask NESTED inside
 * another action's hook, since `runActions` asks about the hook lists.
 */
const permissionAskCompletes = (action: Record<string, unknown>): boolean => {
  const onGranted = listCompletes(action.onGranted);
  const onDenied = listCompletes(action.onDenied);
  const onUnavailable = action.onUnavailable
    ? listCompletes(action.onUnavailable)
    : onGranted || onDenied;
  return onGranted && onDenied && onUnavailable;
};

function isCompletingAction(action: unknown): boolean {
  // `"continue"` is the string literal; `{type:"continue"}` is not an action
  // this runtime runs, so it is not a way forward either.
  if (action === "continue") return true;
  if (!isRecord(action)) return false;
  if (action.type === "dismiss") return true;
  if (action.type === "requestPermission") return permissionAskCompletes(action);
  return Object.values(action).some(listCompletes);
}

/** Total on junk — it decides whether a user is about to be trapped. */
export const actionsCanComplete = (actions: unknown): boolean => listCompletes(actions);
