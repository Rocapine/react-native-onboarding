// Core client and types
export { OnboardingStudioClient } from "./OnboardingStudioClient";
export * from "./types";
export * from "./onboarding-example";
// Cache key helper (advanced/host use — e.g. to read/clear the persisted key)
export {
  getOnboardingCacheKey,
  DEFAULT_ONBOARDING_CACHE_KEY,
} from "./infra/queries/cacheKey";
// ComposableScreen types (Button actions, variable entry, etc.)
export type {
  ButtonAction,
  CustomButtonAction,
  SetVariableButtonAction,
  ComposableVariableEntry,
  ComposableVariableKind,
  WheelPickerElementProps,
  WheelPickerItem,
  WheelPickerRange,
  RichTextElementProps,
  ProgressiveBlurImageElementProps,
  BlurMask,
  LinearBlurMask,
  RadialBlurMask,
  BlurMaskStop,
  BlurAppear,
  ProgressIndicatorElementProps,
  ProgressEasing,
  AnimationEasing,
  SpringConfig,
  EnteringPreset,
  ExitingPreset,
  LayoutPreset,
  EffectPreset,
  EnteringAnimation,
  ExitingAnimation,
  LayoutAnimation,
  ElementEffect,
  ElementAnimation,
  ElementTransform,
} from "./steps/ComposableScreen/types";
export {
  ButtonActionSchema,
  CustomButtonActionSchema,
  SetVariableButtonActionSchema,
  WheelPickerElementPropsSchema,
  generateWheelPickerRangeItems,
  resolveWheelPickerItems,
} from "./steps/ComposableScreen/types";
// The mutable, persisted user-property map that feeds audience resolution
// (moments -> audiences -> paywalls, and onboarding audiences too).
//
// A singleton rather than a provider, so non-React code — a login handler, an
// analytics service — can write to it. See `userProperties/store.ts` for why
// this one piece of state departs from the package's provider+context pattern.
//
// The internal helpers (`toQueryParams`, `paramsHash`, `applyUserPropertyPatch`,
// `resolveEffectiveParams`) are deliberately NOT exported: they are
// implementation detail, and `paramsHash` in particular is a cache-key concern a
// host reproducing it would only drift from.
export {
  userProperties,
  useUserProperties,
  createUserPropertyStore,
  USER_PROPERTIES_STORAGE_KEY,
  RESERVED_USER_PROPERTY_KEYS,
  isReservedUserPropertyKey,
} from "./userProperties";
export type {
  UserProperties,
  UserPropertyPatch,
  UserPropertyValue,
  UserPropertySnapshot,
  UserPropertyStorage,
  UserPropertyStore,
} from "./userProperties";
// `register(moment, feature)` — gate a feature on a moment. The decision helpers
// are exported because they are pure: a host building its own gating on top of
// `catalog` can reuse the SDK's exact rules rather than reimplement them slightly
// differently. `runRegister` and `RegisterDeps` stay internal — that seam exists
// for its own test.
export { resolveRegisterDecision, shouldRunFeature } from "./paywalls/register";
export type { RegisterDecision, RegisterFeature, RegisterResult } from "./paywalls/register";
export { DEFAULT_REGISTER_TIMEOUT_MS } from "./paywalls/PaywallProvider";
// A step that IS a paywall: `payload.moment` names a moment, and the audience
// waterfall behind it picks which paywall renders.
export type { PaywallStepType } from "./steps/Paywall/types";
export { PaywallStepTypeSchema, PaywallStepPayloadSchema } from "./steps/Paywall/types";
// Payload diagnostics — non-fatal detection of keys placed at an element's top
// level that the schema silently drops (e.g. `animation` outside `props`).
export {
  collectUnknownElementKeys,
  collectUnknownKeysInSteps,
  formatUnknownElementKeys,
} from "./screens/unknownKeys";
export type { UnknownElementKey } from "./screens/unknownKeys";
// Hooks and providers
export * from "./infra";
// Navigation adapter (dependency-injected navigation)
export type { OnboardingNavigationAdapter } from "./infra/navigation/types";
export { expoRouterAdapter } from "./infra/navigation/expoRouterAdapter";
// Branching
export { resolveNextStepNumber } from "./resolveNextStepNumber";
export { resolveStartStepNumber } from "./resolveStartStepNumber";
export { evaluateCondition, evaluateLeaf, isConditionGroup } from "./evaluateCondition";
export type { Condition } from "./evaluateCondition";
export type {
  LeafCondition,
  ConditionGroup,
  ConditionValue,
  ConditionOperator,
  Branch,
  NextStep,
} from "./steps/common.types";
export {
  BaseStepTypeSchema,
  LeafConditionSchema,
  ConditionGroupSchema,
  BranchSchema,
  NextStepSchema,
  ConditionOperatorSchema,
  ConditionValueSchema,
  UNARY_CONDITION_OPERATORS,
  isUnaryConditionOperator,
  ONBOARDING_END_STEP_ID,
} from "./steps/common.types";
// Product runtime (paywall phase 3) — vendor-neutral store products
export * from "./products";
// Paywalls (paywall phase 5) — catalog types, provider, and the `usePaywall` hook
export type {
  Paywall,
  // Exported so a host's custom paywall screen can type the product map it
  // receives without restating the shape.
  PaywallCustomPayload,
  PaywallCatalog,
  PaywallOptions,
  GetPaywallsResponseHeaders,
  PresentResult,
  // Exported so a host can switch exhaustively on WHY a presentation failed
  // rather than pattern-matching the message.
  PresentErrorReason,
} from "./paywalls/types";
export { PaywallProvider, usePaywallHost } from "./paywalls/PaywallProvider";
// The custom-screen registry lives on PaywallProvider now (two renderers read
// it: PaywallHost's Modal and the inline Paywall onboarding step), so its types
// live in the headless package. onboarding-ui re-exports both names.
export type { CustomPaywallScreenProps, CustomPaywallScreens } from "./paywalls/customScreens";
export type { PaywallContextValue } from "./paywalls/PaywallProvider";
export { usePaywall } from "./paywalls/usePaywall";
// Exported so a host can switch exhaustively on what the catalog is doing
// rather than inferring it from `isReady` plus a non-null check.
export type { CatalogStatus } from "./paywalls/present";
export type { UsePaywallResult } from "./paywalls/usePaywall";
