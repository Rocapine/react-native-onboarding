/**
 * Parks `register()` callers while the paywall catalog is still loading, and
 * wakes them when it settles or when their own timeout elapses.
 *
 * Extracted from `PaywallProvider` — rather than written inline over a couple of
 * refs — because it has two invariants that are easy to get wrong and impossible
 * to assert from inside a component without a DOM (this repo's tests run in
 * vitest's default `node` environment):
 *
 * 1. **A waiter resolves exactly once.** A timeout can fire after a real settle
 *    already woke the waiter. Resolving a Promise twice is harmless in itself,
 *    but the bookkeeping around it is not — a stale entry left in the set would
 *    be woken by the NEXT settle, running a continuation that belongs to nobody.
 * 2. **Draining must not skip a re-parked waiter.** A woken caller's continuation
 *    may call `register()` again and park immediately; mutating the set while
 *    iterating it would either miss that new waiter or loop over it. So the set
 *    is swapped out before it is drained.
 *
 * The timer is injected so both invariants are testable without real time.
 */

/** Cancels the scheduled callback. */
export type ScheduleCancel = () => void;
export type Schedule = (fn: () => void, ms: number) => ScheduleCancel;

export type CatalogSettleWaiter = {
  /** Resolves when the catalog stops loading, or after `timeoutMs`. */
  wait: (timeoutMs: number) => Promise<void>;
  /** Wakes every parked waiter. Called when the catalog status leaves "loading". */
  settle: () => void;
};

const defaultSchedule: Schedule = (fn, ms) => {
  const timer = setTimeout(fn, ms);
  return () => clearTimeout(timer);
};

export const createCatalogSettleWaiter = (
  isLoading: () => boolean,
  schedule: Schedule = defaultSchedule
): CatalogSettleWaiter => {
  let waiters = new Set<() => void>();

  return {
    wait: (timeoutMs) =>
      new Promise<void>((resolve) => {
        // Nothing to wait for — do not allocate a timer or an entry.
        if (!isLoading()) return resolve();

        let settled = false;
        let cancelTimer: ScheduleCancel = () => {};

        const finish = () => {
          if (settled) return; // invariant 1
          settled = true;
          waiters.delete(finish);
          cancelTimer();
          resolve();
        };

        waiters.add(finish);
        cancelTimer = schedule(finish, timeoutMs);
      }),

    settle: () => {
      // Swapped before draining — invariant 2.
      const parked = waiters;
      waiters = new Set();
      for (const wake of parked) wake();
    },
  };
};
