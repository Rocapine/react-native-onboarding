// Core client and types
export { OnboardingStudioClient } from "./OnboardingStudioClient";
export * from "./types";
export * from "./onboarding-example";
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
// Hooks and providers
export * from "./infra";
// Navigation adapter (dependency-injected navigation)
export type { OnboardingNavigationAdapter } from "./infra/navigation/types";
export { expoRouterAdapter } from "./infra/navigation/expoRouterAdapter";
// Branching
export { resolveNextStepNumber } from "./resolveNextStepNumber";
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
} from "./steps/common.types";
