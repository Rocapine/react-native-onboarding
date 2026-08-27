import { z } from "zod";
import { CustomPayloadSchema } from "../types";

/**
 * UI mirror of the headless `PaywallStepType`. Re-declared rather than
 * imported, matching every other `UI/Pages/{Type}/types.ts` — and, as the root
 * CLAUDE.md warns, drift between the two is NOT caught by TypeScript. Keep the
 * field sets identical to `packages/onboarding/src/steps/Paywall/types.ts`.
 *
 * `displayProgressHeader` is required (not `.optional()`) to match the
 * `ComposableScreen` mirror beside it — `OnboardingTemplate` reads it directly.
 */
export const PaywallStepTypeSchema = z.object({
  id: z.string(),
  type: z.literal("Paywall"),
  name: z.string(),
  displayProgressHeader: z.boolean(),
  payload: z.object({
    /** A `moments.key`. The waterfall behind it picks which paywall renders. */
    moment: z.string().min(1),
  }),
  customPayload: CustomPayloadSchema,
  figmaUrl: z.string().nullish(),
});

export type PaywallStepType = z.infer<typeof PaywallStepTypeSchema>;
