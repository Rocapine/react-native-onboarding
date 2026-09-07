import type {
  ComposableVariableEntry,
  ComposableVariableKind,
} from "@rocapine/react-native-onboarding";
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
//                      write back into the context); warns if unregistered, aborts
//                      the loop on throw.
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
export async function runActions(
  actions: ButtonAction[],
  ctx: RenderContext
): Promise<void> {
  const { onContinue, setVariable, customActions, getVariables } = ctx;
  // Read live variables at press time (NOT a render-time snapshot) so actions
  // always act on the current values.
  const variables = getVariables();

  for (const act of actions) {
    if (act === "continue") {
      onContinue();
      return;
    }
    if (act.type === "dismiss") {
      onContinue({ status: "dismissed" });
      return;
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
      if (result.status === "purchased" && act.onSuccess) await runActions(act.onSuccess, ctx);
      else if (result.status === "cancelled" && act.onCancel) await runActions(act.onCancel, ctx);
      else if (result.status === "error") {
        if (act.onError) await runActions(act.onError, ctx);
        else
          console.warn(
            "[ComposableScreen] `purchase` failed with no `onError` actions declared:",
            result.error
          );
      } else if (result.status === "pending") {
        // Pending means UNCONFIRMED, not successful — deliberately its own hook
        // rather than falling through to `onSuccess`, which would let a paywall
        // grant access for a purchase that may never complete. On the Stripe
        // path this is the ONLY outcome `purchase()` ever returns.
        if (act.onPending) await runActions(act.onPending, ctx);
        else
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
      if (result.status === "restored" && act.onSuccess) await runActions(act.onSuccess, ctx);
      else if (result.status === "nothing_to_restore" && act.onNothingToRestore)
        await runActions(act.onNothingToRestore, ctx);
      else if (result.status === "error") {
        if (act.onError) await runActions(act.onError, ctx);
        else
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
        if (act.onGranted) await runActions(act.onGranted, ctx);
        else
          console.warn(
            `[ComposableScreen] \`requestPermission\` ("${act.kind}") was GRANTED with no \`onGranted\` actions declared — nothing ran, so the screen is unchanged.`
          );
        continue;
      }

      if (outcome === "denied") {
        if (act.onDenied) await runActions(act.onDenied, ctx);
        else
          console.warn(
            `[ComposableScreen] \`requestPermission\` ("${act.kind}") was DENIED with no \`onDenied\` actions declared — nothing ran, so the screen is unchanged. A permission screen should still let the user move on after a refusal.`
          );
        continue;
      }

      // "unavailable" — the optional Expo module is not installed, or the
      // platform has no such permission. NOT treated as the repo's usual silent
      // no-op for an absent press-time dep (haptics): a CTA whose only
      // "continue" sits in `onGranted` would leave the user on a screen with no
      // way forward. Fall back to `onDenied` — "we did not get it" — so an
      // author who declared both real outcomes is safe by construction, and say
      // out loud that the substitution happened.
      if (act.onUnavailable) {
        await runActions(act.onUnavailable, ctx);
        continue;
      }
      if (act.onDenied) {
        console.warn(
          `[ComposableScreen] \`requestPermission\` ("${act.kind}") could not be requested on this build (module not installed, or unsupported platform) and no \`onUnavailable\` actions are declared — running \`onDenied\` instead. Install the optional Expo module for this kind, or declare \`onUnavailable\` explicitly.`
        );
        await runActions(act.onDenied, ctx);
        continue;
      }
      console.error(
        `[ComposableScreen] \`requestPermission\` ("${act.kind}") could not be requested on this build and neither \`onUnavailable\` nor \`onDenied\` is declared — nothing ran. If this action is the screen's only way forward, the user is now stuck. Declare \`onUnavailable\`.`
      );
      continue;
    }

    const handler = customActions[act.function];
    if (!handler) {
      console.warn(
        `[ComposableScreen] No customAction registered for "${act.function}"`
      );
      continue;
    }
    const requested = act.variables ?? [];
    const vars: Record<string, ComposableVariableEntry | undefined> = {};
    for (const name of requested) vars[name] = variables[name];
    try {
      await handler({ variables: vars, setVariable });
    } catch (err) {
      console.error(
        `[ComposableScreen] customAction "${act.function}" threw:`,
        err
      );
      return;
    }
  }
}

/**
 * Resolver order for one `requestPermission` press: the host's own resolver
 * first (the entitlement seam — HealthKit, Screen Time), falling back to the
 * bundled optional-Expo-module resolver when the host has none or returns
 * `undefined` for a kind it does not handle.
 *
 * Never throws. A host resolver that rejects reports `"unavailable"` rather
 * than aborting the press, because the alternative — the `custom` action's
 * abort-the-loop behaviour — would strand the user on a screen whose CTA just
 * silently did nothing.
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
