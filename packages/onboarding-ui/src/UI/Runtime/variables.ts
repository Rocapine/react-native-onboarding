import type { ComposableVariableEntry } from "@rocapine/react-native-onboarding";

/**
 * Element-declared defaults (Carousel.defaultIndex, RadioGroup.defaultValue, …)
 * overlaid by the host-owned variable store. The host ALWAYS wins — inverting
 * this spread clobbers user-driven writes with defaults on every render.
 */
export const mergeVariables = (
  defaults: Record<string, ComposableVariableEntry>,
  hostVariables: Record<string, ComposableVariableEntry>
): Record<string, ComposableVariableEntry> => ({ ...defaults, ...hostVariables });

/**
 * Entry map → primitive map, for `evaluateCondition` / `renderWhen`, which want
 * `Record<string, unknown>` rather than `{value, label}` entries. Skipping this
 * makes every `eq`/`neq` compare against the entry object and silently mis-evaluate.
 */
export const flattenVariables = (
  variables: Record<string, ComposableVariableEntry>
): Record<string, unknown> =>
  Object.fromEntries(Object.entries(variables).map(([k, v]) => [k, v?.value]));

/**
 * Overlay resolved-product variables on top of the merged bag. Products WIN over
 * author variables: they are facts read from the store, and a displayed price
 * must match what StoreKit charges (spec §2.2).
 */
export const withProductVariables = (
  base: Record<string, ComposableVariableEntry>,
  productVariables: Record<string, ComposableVariableEntry> | undefined
): Record<string, ComposableVariableEntry> =>
  productVariables ? { ...base, ...productVariables } : base;
