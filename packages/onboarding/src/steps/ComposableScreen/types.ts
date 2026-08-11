import { z } from "zod";
import { BaseStepTypeSchema } from "../common.types";
import { ScreenElementsSchema } from "../../screens/types";

// Everything screen-agnostic now lives in src/screens/types.ts. Re-exported here
// so every existing import path — including host apps, onboarding-studio, and the
// documented `dist/steps/ComposableScreen/types.js` validation recipe in
// CLAUDE.md — keeps resolving.
export * from "../../screens/types";

export const ComposableScreenStepPayloadSchema = z.object({
  elements: ScreenElementsSchema,
});

export const ComposableScreenStepTypeSchema = BaseStepTypeSchema.extend({
  type: z.literal("ComposableScreen"),
  payload: ComposableScreenStepPayloadSchema,
});

export type ComposableScreenStepType = z.infer<typeof ComposableScreenStepTypeSchema>;
