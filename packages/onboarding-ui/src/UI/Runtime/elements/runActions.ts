import type {
  ComposableVariableEntry,
  ComposableVariableKind,
} from "@rocapine/react-native-onboarding";
import { completingActionKind } from "./completingActions";
import type { ButtonAction, PermissionKind } from "./actions";
import type { RenderContext } from "./shared";
import { interpolateIdentifier } from "./shared";
import { evaluateSetVariableExpression } from "./expression";
import { requestPermissionViaExpoModules } from "./permissions";
import type { PermissionOutcome } from "./permissions";

// Decode a multi-select variable's stored value (JSON-encoded string[], as
// written by CheckboxGroup) into a string array. Tolerates undefined / non-array
// / unparseable input by returning [].
function decodeArrayValue(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

// Sequentially runs a list of press actions against the render context. Shared
// by `Button` (its `actions`) and the generic `onPress` on every UIElement
// (wired centrally in renderElement.tsx). Semantics:
//   - "continue"     → advance the onboarding; terminal (stops the loop).
//   - {setVariable}  → write a variable (expression-evaluated when valueMode === "expression").
//   - {custom}       → invoke the host-registered customAction with the requested
//                      variables plus a `setVariable` setter (so the handler can
//                      write back into the context). Retried up to
//                      `retry.maxAttempts` times, each attempt bounded by
//                      `retry.timeoutMs` when declared; then `onResolve` or
//                      `onError`, NEITHER of which is terminal — like
//                      `purchase`/`restore`, the enclosing list carries on.
//   - {dismiss}      → finish the screen with a `{status:"dismissed"}` outcome;
//                      terminal (stops the loop), same as "continue".
//   - {presentPaywall} → ask the host to present a paywall by placement; warns
//                      and no-ops (continues the loop) when the host has no
//                      `presentPaywall` capability.
//   - {requestPermission} → ask the OS, then run onGranted/onDenied/onUnavailable
//                      — nested ButtonAction[] recursed through this same
//                      function, so one press can diverge on the answer. See
//                      `resolvePermissionOutcome` below for the resolver order
//                      and `./permissions.ts` for the module tried per kind.
//
// RETURNS whether the SCREEN WAS COMPLETED — `"continue"` / `{dismiss}`, at any
// nesting depth. Every recursive call into a branch list (`purchase.onSuccess`,
// `requestPermission.onGranted`, …) propagates it, so a terminal action nested
// one level down ends the OUTER list too.
//
// A `custom` handler that FAILS is NOT that: it runs `onError`, the enclosing
// list carries on, and the call reports `false` unless the hook itself
// completed the screen. Round 1 of #196 briefly returned `true` there and broke
// a paid user out of `purchase.onSuccess` before the trailing `"continue"`
// could advance them — "the handler failed" and "the screen is gone" must stay
// separate answers.
//
// It has to, and this was wrong until review round 1 of #196: the recursion
// returned and the outer `for` carried on, so
// `[{requestPermission, onGranted:["continue"]}, "continue"]` — a defensive
// trailing escape an author may well write, and one `hasCompletingAction`
// accepts either way — called `onContinue` TWICE. A duplicate `router.push` in
// the example host; in a host that advances by incrementing an index, a silently
// skipped screen. Both callers (`ButtonElement`, `renderElement`) ignore the
// value; it exists for the recursion.
export async function runActions(
  actions: ButtonAction[],
  ctx: RenderContext
): Promise<boolean> {
  const { onContinue, setVariable, customActions, getVariables } = ctx;
  // Read live variables at press time (NOT a render-time snapshot) so actions
  // always act on the current values.
  const variables = getVariables();

  for (const act of actions) {
    if (act === "continue") {
      onContinue();
      return true;
    }
    if (act.type === "dismiss") {
      onContinue({ status: "dismissed" });
      return true;
    }
    if (act.type === "presentPaywall") {
      if (!ctx.presentPaywall) {
        console.warn(
          "[ComposableScreen] `presentPaywall` action with no host support — pass a `presentPaywall` handler on the ScreenHost."
        );
        continue;
      }
      ctx.presentPaywall(act.placement);
      continue;
    }
    if (act.type === "setVariable") {
      let value: string;
      let kind: ComposableVariableKind | undefined;
      if (act.valueMode === "expression") {
        const computed = evaluateSetVariableExpression(act.value, variables);
        value = computed.value;
        kind = computed.kind;
      } else {
        value = act.value;
        kind = act.kind;
      }

      if (act.arrayOp) {
        // Multi-select set operation on the JSON-encoded string[] used by
        // CheckboxGroup. value/label are the single member being added/removed.
        const entry = variables[act.name];
        const curValues = decodeArrayValue(entry?.value);
        const curLabels = entry?.label ? entry.label.split(", ") : [];
        const memberLabel = act.label ?? value;
        const idx = curValues.indexOf(value);
        const present = idx !== -1;
        const add =
          act.arrayOp === "append" || (act.arrayOp === "toggle" && !present);

        let nextValues: string[];
        let nextLabels: string[];
        if (add) {
          // Dedup: appending an already-present member is a no-op.
          nextValues = present ? curValues : [...curValues, value];
          nextLabels = present ? curLabels : [...curLabels, memberLabel];
        } else {
          // remove, or toggle-when-present
          nextValues = curValues.filter((_, i) => i !== idx);
          nextLabels =
            present && idx < curLabels.length
              ? curLabels.filter((_, i) => i !== idx)
              : curLabels.filter((l) => l !== memberLabel);
        }

        setVariable(act.name, {
          value: JSON.stringify(nextValues),
          label: nextLabels.join(", "),
        });
        continue;
      }

      setVariable(act.name, { value, label: act.label, kind });
      continue;
    }
    if (act.type === "purchase") {
      const runtime = ctx.products;
      if (!runtime) {
        console.warn(
          "[ComposableScreen] `purchase` action with no ProductProvider — pass one to OnboardingProvider."
        );
        continue;
      }
      // `product` names a product slot KEY, not display text — resolve `value`
      // before `label` (see `interpolateIdentifier`'s doc in shared.ts). A
      // RadioGroup driving `{{plan}}` typically has a differently-cased
      // `label` ("Yearly") from its `value` ("yearly"); `interpolate()` would
      // resolve the label and never find a matching product.
      const key = interpolateIdentifier(act.product, variables).trim();
      if (!runtime.products[key]) {
        console.warn(
          `[ComposableScreen] \`purchase\` action: no resolved product for key "${key}".`
        );
        continue;
      }
      const result = await runtime.purchase(key);
      if (result.status === "purchased" && act.onSuccess) {
        if (await runActions(act.onSuccess, ctx)) return true;
      } else if (result.status === "cancelled" && act.onCancel) {
        if (await runActions(act.onCancel, ctx)) return true;
      } else if (result.status === "error") {
        if (act.onError) {
          if (await runActions(act.onError, ctx)) return true;
        } else
          console.warn(
            "[ComposableScreen] `purchase` failed with no `onError` actions declared:",
            result.error
          );
      } else if (result.status === "pending") {
        // Pending means UNCONFIRMED, not successful — deliberately its own hook
        // rather than falling through to `onSuccess`, which would let a paywall
        // grant access for a purchase that may never complete. On the Stripe
        // path this is the ONLY outcome `purchase()` ever returns.
        if (act.onPending) {
          if (await runActions(act.onPending, ctx)) return true;
        } else
          console.warn(
            "[ComposableScreen] `purchase` returned pending (a Stripe Payment Link always does; Ask-to-Buy and deferred store transactions also) with no `onPending` actions declared — nothing ran, so the screen is unchanged. Declare `onPending`, or handle it in the host."
          );
      }
      continue;
    }

    if (act.type === "restore") {
      const runtime = ctx.products;
      if (!runtime) {
        console.warn(
          "[ComposableScreen] `restore` action with no ProductProvider — pass one to OnboardingProvider."
        );
        continue;
      }
      const result = await runtime.restore();
      if (result.status === "restored" && act.onSuccess) {
        if (await runActions(act.onSuccess, ctx)) return true;
      } else if (result.status === "nothing_to_restore" && act.onNothingToRestore) {
        if (await runActions(act.onNothingToRestore, ctx)) return true;
      } else if (result.status === "error") {
        if (act.onError) {
          if (await runActions(act.onError, ctx)) return true;
        } else
          console.warn(
            "[ComposableScreen] `restore` failed with no `onError` actions declared:",
            result.error
          );
      }
      continue;
    }

    if (act.type === "requestPermission") {
      const outcome = await resolvePermissionOutcome(act.kind, ctx);

      if (outcome === "granted") {
        if (act.onGranted) {
          if (await runActions(act.onGranted, ctx)) return true;
        } else
          console.warn(
            `[ComposableScreen] \`requestPermission\` ("${act.kind}") was GRANTED with no \`onGranted\` actions declared — nothing ran, so the screen is unchanged.`
          );
        continue;
      }

      if (outcome === "denied") {
        // No escape hatch here on purpose, unlike "unavailable" below. "Keep
        // the user on this screen until they allow it" is a real authored
        // intent — the hard permission gate — and it is expressed by leaving
        // `onDenied` off. Advancing anyway would silently defeat it. Only the
        // ask NOBODY can influence gets rescued.
        if (act.onDenied) {
          if (await runActions(act.onDenied, ctx)) return true;
        } else
          console.warn(
            `[ComposableScreen] \`requestPermission\` ("${act.kind}") was DENIED with no \`onDenied\` actions declared — nothing ran, so the screen is unchanged. A permission screen should still let the user move on after a refusal.`
          );
        continue;
      }

      // "unavailable" — the optional Expo module is not installed, or the
      // platform has no such permission. A packaging fact, not a user decision,
      // and one no authored payload can predict.
      //
      // A declared `onUnavailable` is authored intent and always wins.
      if (act.onUnavailable) {
        if (await runActions(act.onUnavailable, ctx)) return true;
        continue;
      }

      // Review round 1, findings 1 and 2. The first version fell back to
      // `onDenied`, which failed in both directions at once:
      //
      //  - It ran the whole refusal branch, so a screen authored the way both
      //    LLM skills recommend wrote `att = "denied"` for a user who was never
      //    asked. Analytics, `renderWhen` gates and `resolveNextStepNumber`
      //    branching then read a decision nobody made — signalled by one
      //    console.warn, in an app where nothing watches the JS console.
      //  - It rescued nobody when `onDenied` was absent too. An
      //    `onGranted`-only CTA on a build with no permission module logged an
      //    error and did nothing, for 100% of that build's users: no CTA, and no
      //    back chevron on a `displayProgressHeader: false` step.
      //
      // So: no fabricated refusal, and no dead end either. If the author put a
      // completing action anywhere in this ask — i.e. the press was meant to be
      // a way OFF the screen, which is the SDK's own `actionsCanComplete`
      // question rather than a second guess at it — complete the screen and
      // nothing else. If it was never a way forward (a "turn on notifications"
      // button beside its own Skip CTA), leaving the user put is correct.
      //
      // Substituting the author's own escape means its OUTCOME too, and round 1
      // got that wrong (review round 2, finding 1): it called `onContinue()`
      // with no outcome, which is the ONE call every host reads as "advance" —
      // including `Pages/Paywall/Renderer`'s hard gate, since
      // `shouldAdvanceOnComplete(undefined)` is `true`. An ask that authored
      // `{dismiss}` on both outcomes — an author who wrote no way past the
      // paywall at all — therefore handed a module-less build's users the gated
      // content for free, signalled by one console.error.
      //
      // So the stand-in is the KIND the author authored, `{dismiss}` winning
      // when the ask can reach both: nobody was asked anything, so the SDK must
      // not claim the more permissive of the two answers. That costs nothing
      // where the two coincide — an onboarding step ignores the outcome and
      // still advances, a `present()`ed paywall resolves as dismissed
      // (`PaywallHost.toPresentResult`) — and holds the gate where they do not.
      // `undefined` means the press was never a way OFF the screen (a "turn on
      // notifications" button beside its own Skip CTA), and then leaving the
      // user put is correct.
      const escape = completingActionKind([
        ...(act.onGranted ?? []),
        ...(act.onDenied ?? []),
      ]);
      if (escape) {
        console.error(
          `[ComposableScreen] \`requestPermission\` ("${act.kind}") could not be requested on this build (module not installed, or unsupported platform) and no \`onUnavailable\` actions are declared — completing the screen with this ask's own \`${escape}\`, because this press was its way forward. No \`onDenied\` side effect ran: the user never refused anything. Install the optional Expo module for this kind, or declare \`onUnavailable\` explicitly.`
        );
        if (escape === "dismiss") onContinue({ status: "dismissed" });
        else onContinue();
        return true;
      }
      console.error(
        `[ComposableScreen] \`requestPermission\` ("${act.kind}") could not be requested on this build (module not installed, or unsupported platform) and no \`onUnavailable\` actions are declared — nothing ran. Install the optional Expo module for this kind, or declare \`onUnavailable\` explicitly.`
      );
      continue;
    }

    // ONE failure rule, every way a `custom` action can fail (semantics
    // decisions 1 and 2, #191 — recorded on the issue, 2026-09-11). An
    // unregistered name, a thrown handler and an attempt that never settles
    // all do the same thing: log, run `onError`, then LET THE LIST CARRY ON,
    // exactly as `purchase`/`restore` already do.
    //
    // The single tail below is the point, not a tidy-up. Before it, a throw
    // returned `false` here and aborted the list while an unregistered name
    // continued it — two failure modes of one action disagreeing with each
    // other, with nothing in the payload, the schema or the console telling
    // them apart (#266). The rationale for the abort was that a trailing
    // `"continue"` would walk the user onto a screen reading variables the
    // handler never wrote; the answer to that is `onResolve`, which is where
    // an author puts what must only run on success.
    //
    // `resolved` is therefore the ONLY branch, and it is computed before the
    // tail rather than returned from inside each failure case.
    const handler = customActions[act.function];
    const maxAttempts = act.retry?.maxAttempts ?? 1;
    const delayMs = act.retry?.delayMs ?? 0;
    const timeoutMs = act.retry?.timeoutMs;
    let resolved = false;

    if (!handler) {
      // A name the host never registered — a typo, or a payload published ahead
      // of the app build that wires the handler. Round 1 of this PR skipped the
      // action whole, hooks included, which turned the documented async gate
      // (`onResolve: ["continue"]`) into a permanently dead CTA signalled by one
      // console line (review round 1, findings 1 and 7). The requested work did
      // not happen, so this is the ERROR outcome: `onResolve` must NOT run.
      console.error(
        `[ComposableScreen] No customAction registered for "${act.function}" — the action did nothing.${
          act.onResolve ? " `onResolve` did NOT run: nothing resolved." : ""
        }${
          act.onError ? " Running `onError`." : ""
        } Register it on OnboardingProvider.customActions, or fix the \`function\` name.`
      );
    } else {
      const requested = act.variables ?? [];
      const vars: Record<string, ComposableVariableEntry | undefined> = {};
      for (const name of requested) vars[name] = variables[name];
      // The variables handed to the handler are the PRESS-TIME snapshot, and a
      // retry reuses it rather than re-reading: an attempt is a repeat of the
      // same request, not a new one. `setVariable` still writes through live.
      let lastError: unknown;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await withTimeout(
            Promise.resolve(handler({ variables: vars, setVariable })),
            timeoutMs,
            act.function
          );
          resolved = true;
          break;
        } catch (err) {
          lastError = err;
          if (attempt < maxAttempts) {
            console.warn(
              `[ComposableScreen] customAction "${act.function}" ${describeFailure(err)} on attempt ${attempt}/${maxAttempts}; retrying`,
              err
            );
            if (delayMs > 0) await sleep(delayMs);
          }
        }
      }

      if (!resolved) {
        // Logged even when `onError` is declared: a failed handler is an
        // exception, and a declared hook is error UI, not a reason to lose the
        // stack trace.
        console.error(
          `[ComposableScreen] customAction "${act.function}" ${describeFailure(lastError)}${
            maxAttempts > 1 ? ` on all ${maxAttempts} attempts` : ""
          }:`,
          lastError
        );
      }
    }

    if (resolved) {
      // Non-terminal on its own, but a `"continue"` INSIDE it completes the
      // screen — so it propagates, exactly like every other branch list here.
      if (act.onResolve && (await runActions(act.onResolve, ctx))) return true;
      continue;
    }
    // The failure tail. `return true` only when the hook itself completed the
    // screen — `true` means "the screen is GONE", and a failed handler leaves
    // it very much present.
    if (act.onError && (await runActions(act.onError, ctx))) return true;
    continue;
  }
  // Ran to the end without completing the screen.
  return false;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A `custom` attempt that never settled (#264). Its own class so the console
 * can say WHICH failure happened — "threw" and "did not settle" send a host
 * developer to different code — while the action layer keeps treating the two
 * identically.
 */
class CustomActionTimeoutError extends Error {
  constructor(fn: string, timeoutMs: number) {
    super(
      `customAction "${fn}" did not settle within ${timeoutMs}ms (retry.timeoutMs)`
    );
    this.name = "CustomActionTimeoutError";
  }
}

const describeFailure = (err: unknown): string =>
  err instanceof CustomActionTimeoutError ? "did not settle in time" : "threw";

/**
 * Bound ONE attempt's duration (#264). Absent `timeoutMs` is unbounded — the
 * behaviour before this existed, and the right default: a legitimate LLM call
 * can take 60s+, and cutting one off by default would be a worse bug than the
 * hang it prevents.
 *
 * The hang it prevents is not a slow screen, it is a DEAD one. `handler` is
 * awaited while `runGuardedActions` holds the single-flight claim, so a promise
 * that never settles leaves `actions.pending.<elementId>` reading `"true"`
 * forever — and the payload the docs recommend disables the CTA on exactly
 * that, with no back chevron on a `displayProgressHeader: false` step.
 *
 * The abandoned `work` promise keeps whatever handler `Promise.race` attached,
 * so a late rejection is already handled and cannot surface as an unhandled
 * one. The timer is cleared in a `finally` so a handler that resolves first
 * does not hold the event loop open for the rest of the timeout.
 */
const withTimeout = async (
  work: Promise<void>,
  timeoutMs: number | undefined,
  fn: string
): Promise<void> => {
  if (timeoutMs == null) return work;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new CustomActionTimeoutError(fn, timeoutMs)),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
};

/**
 * `runActions` for a pressable element, with the runtime's single-flight guard
 * (#191). A second press while the first list is still awaiting is DROPPED —
 * before it, a tap during a slow `custom` handler ran the handler again.
 *
 * While the claim is held, `actions.pending` and `actions.pending.<elementId>`
 * read `"true"` in the variable bag, so a payload can gate a spinner or disable
 * the CTA through `renderWhen`/`disabledWhen` with no host code (see
 * `Runtime/inFlight.ts`).
 *
 * The release is in a `finally`: a handler that rejects must not leave the
 * button permanently dead. `runActions` swallows a handler throw itself, but a
 * bug anywhere else in the list would escape, and a dead CTA is worse than a
 * crash the host's ErrorBoundary can see.
 *
 * A handler that never settles is the case a `finally` cannot reach, because
 * nothing returns: that one needs `retry.timeoutMs` on the action (#264).
 *
 * A BLANK id is not guarded at all. The claim is keyed on the authored id and
 * the schema declares `id: z.string()` with no `.min(1)`, so two unrelated
 * elements can both arrive as `""` and would block each other's presses with no
 * console output and no visual change — a silently dead control, worse than the
 * double-fire the guard exists to stop (review round 2, finding 4). An id that
 * identifies nothing also has no spellable `actions.pending.<elementId>`, so
 * there is nothing to gate a pending UI on either. Duplicate NON-blank ids do
 * still share a claim: there the authored id is the identity the whole runtime
 * already uses (the pending key, React keys, `Repeat`'s `suffixIds`), and the
 * fix is payload-level id uniqueness rather than a second identity here.
 */
export async function runGuardedActions(
  elementId: string,
  actions: ButtonAction[],
  ctx: RenderContext
): Promise<boolean> {
  if (elementId.trim() === "") return runActions(actions, ctx);
  // A dropped press completed nothing, so it reports `false` exactly like a
  // list that ran to the end — same meaning as `runActions`'s return value.
  if (!ctx.beginActions(elementId)) return false;
  try {
    return await runActions(actions, ctx);
  } finally {
    ctx.endActions(elementId);
  }
}

/**
 * Resolver order for one `requestPermission` press: the host's own resolver
 * first (the entitlement seam — HealthKit, Screen Time), falling back to the
 * bundled optional-Expo-module resolver when the host has none or returns
 * `undefined` for a kind it does not handle.
 *
 * Never throws. A host resolver that rejects reports `"unavailable"` rather
 * than letting the exception escape the press: an unhandled rejection out of
 * here would take the whole list with it, stranding the user on a screen whose
 * CTA silently did nothing. `"unavailable"` routes into the ask's own hooks,
 * which is where an author can answer it.
 */
async function resolvePermissionOutcome(
  kind: PermissionKind,
  ctx: RenderContext
): Promise<PermissionOutcome> {
  if (ctx.requestPermission) {
    try {
      const hostOutcome = await ctx.requestPermission(kind);
      if (hostOutcome) return hostOutcome;
    } catch (err) {
      console.error(
        `[ComposableScreen] host \`requestPermission\` resolver threw for "${kind}":`,
        err
      );
      return "unavailable";
    }
  }
  return requestPermissionViaExpoModules(kind);
}
