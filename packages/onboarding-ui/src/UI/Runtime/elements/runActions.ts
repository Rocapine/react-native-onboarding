import type {
  ComposableVariableEntry,
  ComposableVariableKind,
} from "@rocapine/react-native-onboarding";
import type { ButtonAction } from "./actions";
import type { RenderContext } from "./shared";
import { evaluateSetVariableExpression } from "./expression";

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
