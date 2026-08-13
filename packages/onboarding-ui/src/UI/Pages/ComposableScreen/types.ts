import { z } from "zod";
import { CustomPayloadSchema } from "../types";
import { ComposableScreenStepPayloadSchema } from "../../Runtime/types";

// Element / screen types live in UI/Runtime/types.ts, shared with the paywall
// renderer. Re-exported here so existing deep imports keep resolving. Only the
// onboarding STEP schema lives in this file — mirroring the headless split of
// src/screens/types.ts (elements) vs src/steps/ComposableScreen/types.ts (step).
export * from "../../Runtime/types";

export const ComposableScreenStepTypeSchema = z.object({
  id: z.string(),
  type: z.literal("ComposableScreen"),
  name: z.string(),
  displayProgressHeader: z.boolean(),
  payload: ComposableScreenStepPayloadSchema,
  customPayload: CustomPayloadSchema,
  continueButtonLabel: z.string().optional().default("Continue"),
  figmaUrl: z.string().nullish(),
});

export type ComposableScreenStepType = z.infer<typeof ComposableScreenStepTypeSchema>;
