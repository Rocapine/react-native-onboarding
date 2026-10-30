import { z } from "zod";
import { BaseStepTypeSchema } from "../common.types";
import { ScreenElementsSchema } from "../../screens/types";

// Everything screen-agnostic now lives in src/screens/types.ts. Re-exported here
// so every existing import path — including host apps, onboarding-studio, and the
// documented `dist/steps/ComposableScreen/types.js` validation recipe in
// CLAUDE.md — keeps resolving.
export * from "../../screens/types";

/**
 * @deprecated The `ComposableScreen` step type is deprecated and will be removed
 * in a future major version. Existing steps keep parsing and rendering unchanged.
 * Use a built-in step type for new steps: `MediaContent`, `Question`, `Picker`,
 * `Carousel`, `Loader`, `Ratings`, `Commitment` or `Paywall`. The UIElement types
 * re-exported from this module are not deprecated: paywalls use them.
 */
export const ComposableScreenStepPayloadSchema = z.object({
  elements: ScreenElementsSchema,
});

/**
 * @deprecated The `ComposableScreen` step type is deprecated and will be removed
 * in a future major version. Existing steps keep parsing and rendering unchanged.
 * Use a built-in step type for new steps: `MediaContent`, `Question`, `Picker`,
 * `Carousel`, `Loader`, `Ratings`, `Commitment` or `Paywall`. The UIElement types
 * re-exported from this module are not deprecated: paywalls use them.
 */
export const ComposableScreenStepTypeSchema = BaseStepTypeSchema.extend({
  type: z.literal("ComposableScreen"),
  payload: ComposableScreenStepPayloadSchema,
});

/**
 * @deprecated The `ComposableScreen` step type is deprecated and will be removed
 * in a future major version. Existing steps keep parsing and rendering unchanged.
 * Use a built-in step type for new steps: `MediaContent`, `Question`, `Picker`,
 * `Carousel`, `Loader`, `Ratings`, `Commitment` or `Paywall`. The UIElement types
 * re-exported from this module are not deprecated: paywalls use them.
 */
export type ComposableScreenStepType = z.infer<typeof ComposableScreenStepTypeSchema>;
