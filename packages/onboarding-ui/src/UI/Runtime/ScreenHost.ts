import type {
  ComposableVariableEntry,
  CustomActions,
  ProductRuntime,
} from "@rocapine/react-native-onboarding";

/**
 * Outcome passed to `complete`. The `dismiss` ButtonAction passes
 * `{ status: "dismissed" }`; onboarding ignores the argument entirely. Kept
 * open-ended (rather than a closed union) because a paywall host resolves its
 * own richer outcome shape (e.g. purchased/cancelled/error) from the same
 * channel, and that shape is that host's to define, not the engine's.
 */
export type CompleteOutcome = {
  status: string;
  [key: string]: unknown;
};

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
   * the placement. Reached from a `"continue"` press action (no outcome) or a
   * `"dismiss"` action (`{ status: "dismissed" }`). The argument is optional so
   * a host that only ever advances/ends — e.g. onboarding — can ignore it.
   */
  complete: (outcome?: CompleteOutcome) => void;
  /** Host-registered handlers for `{ type: "custom" }` actions. Must be stable. */
  customActions: CustomActions;
  /**
   * Resolved store products + purchase/restore, when the host provides them.
   * Undefined on a host with no billing. MUST be referentially stable across
   * variable writes — it lands in RenderContext, and an unstable value
   * re-renders every memoized element on every write.
   */
  products?: ProductRuntime;
  /**
   * Present a paywall by placement, when the host supports it. Undefined on a
   * host without the capability — the `presentPaywall` ButtonAction warns and
   * no-ops, mirroring `products`/`purchase`/`restore`.
   */
  presentPaywall?: (placement: string) => void;
  /** Offset for keyboard avoidance — the measured progress header, or 0. */
  keyboardVerticalOffset: number;
  /**
   * How long to wait after mount before releasing a deferred
   * `animation.entering.once` entrance, in ms. Defaults to
   * `DEFAULT_ENTERING_SETTLE_MS`.
   *
   * This is a duration rather than a framework signal because
   * `InteractionManager.runAfterInteractions` fails in two opposite ways: it is
   * stubbed in RN 0.85+ (fires on the next tick, defers nothing), and on earlier
   * versions where it is implemented, its queue reportedly does not drain while
   * `react-native-screens` push transitions are active (fires late or never).
   * The navigation adapter exposes no transition-complete hook either.
   *
   * The host is the only party that knows its own navigator's transition
   * duration, so it is the right place to inject it. Set it to match the push
   * animation; erring slightly long is safer than short — too long shows a beat
   * of static screen, too short puts the entrance back under the transition,
   * which is the bug being fixed.
   */
  enteringSettleDelayMs?: number;
};

export const noopScreenHost: ScreenHost = {
  variables: {},
  setVariable: () => {},
  complete: () => {},
  customActions: {},
  keyboardVerticalOffset: 0,
};
