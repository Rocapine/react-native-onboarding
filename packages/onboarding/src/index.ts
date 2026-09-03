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
// The SDK's front door: configuration (`init`) and user identity
// (`setUserProperty`, `reset`), in the shape of the SDKs it sits alongside —
// `Superwall.configure`, `Purchases.configure`, `amplitude.init`.
//
// User properties feed audience resolution for BOTH onboardings and paywalls.
// This is a module-level object rather than a provider so non-React code — a
// login handler, an analytics service — can write to it; see
// `userProperties/store.ts` for why that one departure from the package's
// provider+context pattern is the point rather than an oversight.
//
// `register`/`present` are NOT here: presenting needs the mounted provider's
// state, so they stay on `usePaywall()`.
export { OnboardingStudio } from "./OnboardingStudio";
export type { OnboardingStudioConfig, OnboardingStudioFacade } from "./OnboardingStudio";
// `useUserProperties()` is the React READ path; the write path is the facade.
//
// The internal helpers (`toQueryParams`, `paramsHash`, `applyUserPropertyPatch`,
// `resolveEffectiveParams`, `userPropertyStore`) are deliberately NOT exported:
// they are implementation detail, and `paramsHash` in particular is a cache-key
// concern a host reproducing it would only drift from.
export {
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
// Forward compatibility for element TYPES (#209): an element type published
// after this app shipped is OMITTED rather than failing the whole screen.
// `KNOWN_ELEMENT_TYPES` is the capability list of what this build can render.
export {
  KNOWN_ELEMENT_TYPES,
  dropUnknownElementTypes,
  dropUnknownElementTypesInStep,
  collectUnknownElementTypes,
  collectUnknownElementTypesInSteps,
  formatUnknownElementTypes,
} from "./screens/unknownElementTypes";
export type { UnknownElementType } from "./screens/unknownElementTypes";
// The whole render-boundary decision in one pure call: what to parse, what to
// log, and whether the renderer must supply its own way off the screen — a
// ComposableScreen authors its CTA INSIDE the element tree, so a strip can take
// it and leave a screen nobody can leave. `deriveElementTypeNames` is how a
// rendering package keys the strip on ITS OWN element union instead of this
// one's: what draws has to decide what is kept, and the two packages' installed
// versions can differ.
export { resolveRenderableStep } from "./screens/resolveRenderableStep";
export type { RenderableStep } from "./screens/resolveRenderableStep";
export { hasCompletingAction } from "./screens/completingActions";
export { deriveElementTypeNames } from "./screens/elementTypeRegistry";
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
