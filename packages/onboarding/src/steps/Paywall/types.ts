import { z } from "zod";
import { BaseStepTypeSchema } from "../common.types";

/**
 * A step that IS a paywall.
 *
 * `moment` is a `moments.key` — the same address a host passes to `present()`.
 * It resolves through the catalog `get-paywalls` already returns keyed by
 * moment, which means the audience waterfall has ALREADY picked the variant:
 * targeting and weighted A/B come for free, and this payload needs exactly one
 * field. No wire change was required anywhere for this step type.
 *
 * Deliberately not a paywall id: that would bypass the waterfall, so
 * A/B-testing a paywall inside an onboarding would mean duplicating the whole
 * onboarding.
 *
 * Rendered inline by the UI package's `Pages/Paywall/Renderer.tsx`, and
 * HARD-GATED — only a purchase advances past it.
 */
export const PaywallStepPayloadSchema = z.object({
  moment: z.string().min(1),
});

export const PaywallStepTypeSchema = BaseStepTypeSchema.extend({
  type: z.literal("Paywall"),
  payload: PaywallStepPayloadSchema,
});

export type PaywallStepType = z.infer<typeof PaywallStepTypeSchema>;
