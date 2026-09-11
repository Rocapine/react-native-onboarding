import type { ComposableVariableEntry } from "@rocapine/react-native-onboarding";

/**
 * Runtime-owned in-flight state for press actions (#191).
 *
 * Two problems, one registry:
 *
 * 1. **Re-entrancy.** `ButtonElement.handlePress` awaits `runActions` with no
 *    guard, so a second tap during a slow `custom` handler — an LLM call, a
 *    plan generation — fired the handler a second time. Nothing in the payload
 *    could prevent that: `disabledWhen` can only read a variable the HOST
 *    handler sets, which is exactly the host code an async gate should not
 *    need.
 * 2. **A pending UI with no host code.** The state is projected into the
 *    variable bag as flat dotted keys, the same shape resolved products use, so
 *    `renderWhen` / `disabledWhen` / `{{interpolation}}` read it with no engine
 *    change.
 *
 * The claim is SYNCHRONOUS and ref-backed, never React state: a `setState` is
 * async and batched, so two taps landing in the same tick would both read
 * "not pending" and both win. `onChange` exists only to re-render.
 */

/** True while ANY element on the screen is running its action list. */
export const IN_FLIGHT_ANY_KEY = "actions.pending";

/** True while THIS element is running its action list. */
export const inFlightVariableKey = (elementId: string): string =>
  `${IN_FLIGHT_ANY_KEY}.${elementId}`;

export type InFlightRegistry = {
  /**
   * Claim the in-flight slot for `elementId`. Returns `false` when it is
   * already held — that is the re-entrancy guard, and the caller must not run
   * its actions.
   */
  claim: (elementId: string) => boolean;
  /** Release the slot. A no-op when it was never held, so a `finally` is safe. */
  release: (elementId: string) => void;
};

export const createInFlightRegistry = (
  onChange: (ids: ReadonlySet<string>) => void
): InFlightRegistry => {
  const ids = new Set<string>();
  return {
    claim: (elementId) => {
      if (ids.has(elementId)) return false;
      ids.add(elementId);
      // A fresh Set each time: React (and the memo on the variable projection)
      // compares by identity, and a mutated Set re-renders nothing.
      onChange(new Set(ids));
      return true;
    },
    release: (elementId) => {
      if (!ids.delete(elementId)) return;
      onChange(new Set(ids));
    },
  };
};

/**
 * Overlay the in-flight state on a variable bag. Runtime facts WIN over author
 * variables, like resolved products: an author variable that happens to be
 * named `actions.pending` must not be able to lie about the gate.
 *
 * A per-element key exists only while that element is in flight. Absent reads
 * as "not pending" under both `eq "true"` and `neq "true"`, because
 * `evaluateCondition` stringifies — so there is no third state to author for.
 */
export const withInFlightVariables = (
  base: Record<string, ComposableVariableEntry>,
  inFlightIds: ReadonlySet<string>
): Record<string, ComposableVariableEntry> => {
  const overlay: Record<string, ComposableVariableEntry> = {
    [IN_FLIGHT_ANY_KEY]: { value: inFlightIds.size > 0 ? "true" : "false" },
  };
  for (const id of inFlightIds) overlay[inFlightVariableKey(id)] = { value: "true" };
  return { ...base, ...overlay };
};
