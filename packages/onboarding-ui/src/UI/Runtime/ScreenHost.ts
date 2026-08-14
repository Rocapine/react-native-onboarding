import type {
  ComposableVariableEntry,
  CustomActions,
  ProductRuntime,
} from "@rocapine/react-native-onboarding";

/**
 * Everything the rendering engine needs from whatever is hosting the screen.
 * The onboarding step renderer and the paywall renderer each build one of these;
 * the engine itself knows about neither.
 */
export type ScreenHost = {
  /** Host-owned variable store. Element defaults are overlaid beneath it. */
  variables: Record<string, ComposableVariableEntry>;
  /** Write a variable back into the host store. Must be referentially stable. */
  setVariable: (key: string, entry: ComposableVariableEntry) => void;
  /**
   * Finish this screen. Onboarding → advance to the next step. Paywall → resolve
   * the placement. Reached from a `"continue"` press action.
   */
  complete: () => void;
  /** Host-registered handlers for `{ type: "custom" }` actions. Must be stable. */
  customActions: CustomActions;
  /**
   * Resolved store products + purchase/restore, when the host provides them.
   * Undefined on a host with no billing. MUST be referentially stable across
   * variable writes — it lands in RenderContext, and an unstable value
   * re-renders every memoized element on every write.
   */
  products?: ProductRuntime;
  /** Offset for keyboard avoidance — the measured progress header, or 0. */
  keyboardVerticalOffset: number;
};

export const noopScreenHost: ScreenHost = {
  variables: {},
  setVariable: () => {},
  complete: () => {},
  customActions: {},
  keyboardVerticalOffset: 0,
};
