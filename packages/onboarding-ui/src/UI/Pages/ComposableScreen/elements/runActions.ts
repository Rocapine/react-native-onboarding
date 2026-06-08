import type {
  ComposableVariableEntry,
  ComposableVariableKind,
} from "@rocapine/react-native-onboarding";
import type { ButtonAction } from "./actions";
import type { RenderContext } from "./shared";
import { evaluateSetVariableExpression } from "./expression";

// Sequentially runs a list of press actions against the render context. Shared
// by `Button` (its `actions`) and the generic `onPress` on every UIElement
// (wired centrally in renderElement.tsx). Semantics:
//   - "continue"     → advance the onboarding; terminal (stops the loop).
//   - {setVariable}  → write a variable (expression-evaluated when valueMode === "expression").
//   - {custom}       → invoke the host-registered customAction with the requested
//                      variables; warns if unregistered, aborts the loop on throw.
export async function runActions(
  actions: ButtonAction[],
  ctx: RenderContext
): Promise<void> {
  const { onContinue, setVariable, customActions, variables } = ctx;

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
}
