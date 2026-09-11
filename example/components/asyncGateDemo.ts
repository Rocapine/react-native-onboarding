/**
 * The failure schedule behind the `generatePlan` demo handler (RNO#191).
 *
 * Lives here rather than inlined in `app/_layout.tsx` because the demo is the
 * only place the async gate's ERROR branch can be seen, and the first version
 * of it could never reach that branch: it threw on every odd attempt while the
 * payload retried three times, so every press was fail-then-succeed and
 * `onError` never ran (review round 2, finding 3).
 *
 * The rule is now stated against the cap: fail every attempt of a press, then
 * let the next press through. Presses alternate error / resolve, and the RETRY
 * itself is still exercised — three attempts burn on every failing press.
 * `packages/onboarding-ui/src/UI/Runtime/__tests__/exampleAsyncGate.test.ts`
 * pins the arithmetic against the cap the payload actually declares.
 */

/** Must equal the `retry.maxAttempts` in `app/example/composable-screen.tsx`. */
export const GENERATE_PLAN_MAX_ATTEMPTS = 3;

/**
 * Whether attempt number `attempt` (1-based, counted across the whole session)
 * should throw. Every `maxAttempts` failures are followed by one success, so a
 * press that spends its whole budget lands in `onError` and the next one
 * resolves.
 */
export const shouldGeneratePlanFail = (attempt: number): boolean =>
  attempt % (GENERATE_PLAN_MAX_ATTEMPTS + 1) !== 0;
