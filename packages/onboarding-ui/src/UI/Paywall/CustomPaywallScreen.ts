import type { ComponentType } from "react";
import type { PaywallCustomPayload } from "@rocapine/react-native-onboarding";

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
 * prices — which is exactly what it does not need the studio for — and
 * resolving them here would mean the SDK issuing store round-trips for a
 * screen it does not render.
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
   * Ends the presentation and resolves the pending `present()` call.
   *
   * MUST be called, on every exit path — including the screen's own close
   * button. Until it is, `PaywallProvider` considers this paywall active and
   * every later `present()` resolves `"already-presenting"`. (The
   * acknowledgement timeout only covers a presentation that never appeared,
   * not one that appeared and was never closed.)
   *
   * Called with nothing, it reports `"dismissed"`. Report `"purchased"` when
   * the screen's own purchase succeeded — but note that a purchase made
   * through the SDK's own product runtime is already tracked, and that
   * `PresentResult` describes how the paywall CLOSED, never what the user is
   * entitled to. Read entitlement from the billing SDK, not from this.
   */
  complete: (outcome?: { status: "purchased" | "dismissed" | "cancelled" }) => void;
  /**
   * Which paywall is being shown. `moment` is what the app passed to
   * `present()`; `id` and `name` are the studio's, for analytics. Enough to
   * report a conversion without also handing over the `elements` tree a custom
   * paywall has no use for.
   */
  paywall: {
    id: string;
    name: string;
    moment: string;
    customScreenId: string;
  };
};

/**
 * The registry passed to `PaywallHost`, keyed by the `customScreenId` authored
 * in the studio. A paywall naming a key absent from this map resolves
 * `{ status: "error", reason: "unknown-custom-screen" }` rather than opening an
 * empty Modal.
 */
export type CustomPaywallScreens = Record<string, ComponentType<CustomPaywallScreenProps>>;
