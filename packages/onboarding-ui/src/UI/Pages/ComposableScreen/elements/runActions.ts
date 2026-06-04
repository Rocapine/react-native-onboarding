import type { ButtonAction, ComposableVariableKind } from "@rocapine/react-native-onboarding";
import type { RenderContext } from "./shared";
import type { ComposableVariableEntry } from "../../../Provider/OnboardingProgressProvider";
import { evaluateSetVariableExpression } from "./expression";

/**
 * Run an ordered list of ButtonAction against the render context. Shared by
 * `Button` (its `actions`) and any element's `onClick` (a single action passed
 * as a one-item array) so action semantics never drift between the two.
 *
 * - `"continue"` advances and is terminal (stops the sequence).
 * - `setVariable` writes a variable (expression-evaluated when valueMode is
 *   `"expression"`, else stored literally).
 * - `custom` invokes a registered customAction with the requested variables,
 *   awaited; a throw aborts the remaining sequence (logged, not rethrown).
 */
export const runActions = async (
  actions: ButtonAction[],
  ctx: RenderContext
): Promise<void> => {
  const { onContinue, customActions, variables, setVariable } = ctx;

  for (const act of actions) {
    if (act === "continue") {
      onContinue();
      return;
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
      setVariable(act.name, { value, label: act.label, kind });
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
      await handler({ variables: vars });
    } catch (err) {
      console.error(
        `[ComposableScreen] customAction "${act.function}" threw:`,
        err
      );
      return;
    }
  }
};
