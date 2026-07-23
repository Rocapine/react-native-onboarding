import type { BaseStepType } from "./types";

/**
 * Resolves the 1-indexed step number the onboarding should start on.
 *
 * Reads the (optional, unique) `startStepId` first. Falls back to the first
 * step in the array when `startStepId` is absent or references a step that is
 * not present — mirroring `resolveNextStepNumber`'s unknown-id guard and
 * preserving legacy positional-start behavior.
 *
 * @param steps       - Full ordered steps array
 * @param startStepId - Optional id of the unique start step (from onboarding configuration)
 */
export function resolveStartStepNumber(
  steps: BaseStepType[],
  startStepId?: string
): number {
  if (startStepId) {
    const idx = steps.findIndex((s) => s.id === startStepId);
    if (idx !== -1) return idx + 1; // 1-indexed
  }
  return 1; // fallback: first positional step (legacy)
}
