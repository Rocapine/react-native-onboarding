import type { ComponentType } from "react";
import type { PaywallCustomPayload } from "./types";

/**
 * What a host-registered custom paywall screen receives.
 *
 * The contract is deliberately small. A custom paywall exists because the host
 * already has a screen it wants to render — a StoreKit-driven layout, a Skia
 * animation, anything the element vocabulary cannot express — so the studio's
 * whole contribution is "which screen, and which products". Everything else
 * the screen needs, it already has.
 *
 * In particular there is NO product runtime here, and that is a decision
 * rather than an omission: `collectProductRefs` does not walk `customPayload`,
 * so the SDK resolves no store products for a custom paywall and the screen
 * gets ids, not prices. A native paywall queries the store itself for display
 * prices — which is exactly what it does not need the studio for.
 *
 * DECLARED IN THE HEADLESS PACKAGE, even though only the UI package renders
 * these screens, because there are now TWO renderers: `PaywallHost`'s Modal
 * and the inline `Paywall` onboarding step. The registry they share is
 * published on `PaywallProvider`, which lives here, so the type has to as
 * well. `@rocapine/react-native-onboarding-ui` re-exports both names so
 * existing imports keep resolving.
 */
export type CustomPaywallScreenProps = {
  /**
   * Slot key to per-platform store product id, e.g.
   * `{ monthly: { ios: "com.app.m", android: "app_m" } }`.
   *
   * Never `undefined`: an absent `customPayload` on the wire (an older
   * `get-paywalls`) arrives here as `{}`, so the one prop this screen exists
   * to read always has a shape.
   */
  payload: PaywallCustomPayload;
  /**
   * Ends the presentation and resolves whatever is waiting on it.
   *
   * MUST be called, on every exit path — including the screen's own close
   * button.
   *
   * From `PaywallHost`: until it is called, `PaywallProvider` considers this
   * paywall active and every later `present()` resolves `"already-presenting"`.
   * From an inline `Paywall` onboarding STEP: the step is hard-gated, so only
   * `{ status: "purchased" }` (or no argument at all, which a bare `continue`
   * action produces) advances the onboarding — a `"dismissed"` outcome is
   * deliberately ignored there, and the user stays on the paywall.
   *
   * Note `"pending"` does NOT advance a gated step: a Stripe Payment Link
   * resolves pending, which means UNCONFIRMED. `PresentResult` describes how a
   * paywall CLOSED, never what the user is entitled to — read entitlement from
   * the billing SDK.
   */
  complete: (outcome?: { status: "purchased" | "dismissed" | "cancelled" }) => void;
  /**
   * Which paywall is being shown. `moment` is what resolved it; `id` and
   * `name` are the studio's, for analytics. Enough to report a conversion
   * without also handing over the `elements` tree a custom paywall has no use
   * for.
   */
  paywall: {
    id: string;
    name: string;
    moment: string;
    customScreenId: string;
  };
};

/**
 * The registry, keyed by the `customScreenId` authored in the studio.
 *
 * Register it on `PaywallProvider` — that is the canonical place, and the only
 * one an inline `Paywall` onboarding step can read. `PaywallHost` also accepts
 * it as a prop, which overrides the provider's for that host only; that prop
 * predates the inline step and is kept so 1.72.0 integrations keep compiling.
 *
 * A paywall naming a key absent from the map never renders: `PaywallHost`
 * resolves `{ status: "error", reason: "unknown-custom-screen" }` and never
 * opens its Modal, and an inline step logs and skips rather than trapping the
 * user in the funnel.
 */
export type CustomPaywallScreens = Record<string, ComponentType<CustomPaywallScreenProps>>;
