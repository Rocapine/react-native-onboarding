import { z } from "zod";

export type GradientStop = {
  color: string;
  position?: number;
};

export type GradientEdge =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "topLeft"
  | "topRight"
  | "bottomLeft"
  | "bottomRight";

export type LinearGradientConfig = {
  type: "linear";
  from: GradientEdge;
  to: GradientEdge;
  stops: GradientStop[];
};

export type GradientBackground = LinearGradientConfig;

export const GradientEdgeSchema = z.enum(["top", "bottom", "left", "right", "topLeft", "topRight", "bottomLeft", "bottomRight"]);

const GradientStopSchema = z.object({
  color: z.string(),
  position: z.number().min(0).max(1).optional(),
});

export const GradientBackgroundSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("linear"),
    from: GradientEdgeSchema,
    to: GradientEdgeSchema,
    stops: z.array(GradientStopSchema).min(2, "gradient requires at least 2 stops"),
  }),
]);

export type ShadowOffset = {
  width: number;
  height: number;
};

export const ShadowOffsetSchema = z.object({
  width: z.number(),
  height: z.number(),
});

// ---------------------------------------------------------------------------
// Animation / Transform surface
//
// Schema stays intentionally close to react-native-reanimated: `preset` values
// are the *exact* reanimated builder names (e.g. `FadeInDown`, `SlideOutLeft`,
// `LinearTransition`), so the UI renderer resolves them by direct namespace
// lookup (`Reanimated[preset]`) rather than a translation table. Modifier fields
// (`duration`/`delay`/`spring`/`easing`) map to reanimated builder methods
// (`.duration().delay().springify().easing()`).
// ---------------------------------------------------------------------------

// Reuses the easing-name convention from ProgressIndicatorElement.
export type AnimationEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out";

const AnimationEasingSchema = z.enum(["linear", "ease-in", "ease-out", "ease-in-out"]);

// Mirrors reanimated's `.springify(config)` — only the fields it accepts.
// When `spring` is present it wins over `easing` (matches reanimated semantics).
export type SpringConfig = {
  damping?: number;
  stiffness?: number;
  mass?: number;
};

const SpringConfigSchema = z.object({
  damping: z.number().positive().optional(),
  stiffness: z.number().positive().optional(),
  mass: z.number().positive().optional(),
});

// Exact reanimated entering builder names.
export type EnteringPreset =
  | "FadeIn" | "FadeInUp" | "FadeInDown" | "FadeInLeft" | "FadeInRight"
  | "SlideInUp" | "SlideInDown" | "SlideInLeft" | "SlideInRight"
  | "ZoomIn" | "ZoomInRotate" | "ZoomInUp" | "ZoomInDown" | "ZoomInLeft" | "ZoomInRight"
  | "ZoomInEasyUp" | "ZoomInEasyDown"
  | "BounceIn" | "BounceInUp" | "BounceInDown" | "BounceInLeft" | "BounceInRight"
  | "FlipInXUp" | "FlipInYLeft" | "FlipInXDown" | "FlipInYRight" | "FlipInEasyX" | "FlipInEasyY"
  | "StretchInX" | "StretchInY"
  | "RotateInDownLeft" | "RotateInDownRight" | "RotateInUpLeft" | "RotateInUpRight"
  | "RollInLeft" | "RollInRight"
  | "PinwheelIn"
  | "LightSpeedInLeft" | "LightSpeedInRight";

const EnteringPresetSchema = z.enum([
  "FadeIn", "FadeInUp", "FadeInDown", "FadeInLeft", "FadeInRight",
  "SlideInUp", "SlideInDown", "SlideInLeft", "SlideInRight",
  "ZoomIn", "ZoomInRotate", "ZoomInUp", "ZoomInDown", "ZoomInLeft", "ZoomInRight",
  "ZoomInEasyUp", "ZoomInEasyDown",
  "BounceIn", "BounceInUp", "BounceInDown", "BounceInLeft", "BounceInRight",
  "FlipInXUp", "FlipInYLeft", "FlipInXDown", "FlipInYRight", "FlipInEasyX", "FlipInEasyY",
  "StretchInX", "StretchInY",
  "RotateInDownLeft", "RotateInDownRight", "RotateInUpLeft", "RotateInUpRight",
  "RollInLeft", "RollInRight",
  "PinwheelIn",
  "LightSpeedInLeft", "LightSpeedInRight",
]);

// Exact reanimated exiting builder names.
export type ExitingPreset =
  | "FadeOut" | "FadeOutUp" | "FadeOutDown" | "FadeOutLeft" | "FadeOutRight"
  | "SlideOutUp" | "SlideOutDown" | "SlideOutLeft" | "SlideOutRight"
  | "ZoomOut" | "ZoomOutRotate" | "ZoomOutUp" | "ZoomOutDown" | "ZoomOutLeft" | "ZoomOutRight"
  | "ZoomOutEasyUp" | "ZoomOutEasyDown"
  | "BounceOut" | "BounceOutUp" | "BounceOutDown" | "BounceOutLeft" | "BounceOutRight"
  | "FlipOutXUp" | "FlipOutYLeft" | "FlipOutXDown" | "FlipOutYRight" | "FlipOutEasyX" | "FlipOutEasyY"
  | "StretchOutX" | "StretchOutY"
  | "RotateOutDownLeft" | "RotateOutDownRight" | "RotateOutUpLeft" | "RotateOutUpRight"
  | "RollOutLeft" | "RollOutRight"
  | "PinwheelOut"
  | "LightSpeedOutLeft" | "LightSpeedOutRight";

const ExitingPresetSchema = z.enum([
  "FadeOut", "FadeOutUp", "FadeOutDown", "FadeOutLeft", "FadeOutRight",
  "SlideOutUp", "SlideOutDown", "SlideOutLeft", "SlideOutRight",
  "ZoomOut", "ZoomOutRotate", "ZoomOutUp", "ZoomOutDown", "ZoomOutLeft", "ZoomOutRight",
  "ZoomOutEasyUp", "ZoomOutEasyDown",
  "BounceOut", "BounceOutUp", "BounceOutDown", "BounceOutLeft", "BounceOutRight",
  "FlipOutXUp", "FlipOutYLeft", "FlipOutXDown", "FlipOutYRight", "FlipOutEasyX", "FlipOutEasyY",
  "StretchOutX", "StretchOutY",
  "RotateOutDownLeft", "RotateOutDownRight", "RotateOutUpLeft", "RotateOutUpRight",
  "RollOutLeft", "RollOutRight",
  "PinwheelOut",
  "LightSpeedOutLeft", "LightSpeedOutRight",
]);

// Exact reanimated layout-transition builder names.
export type LayoutPreset =
  | "LinearTransition" | "FadingTransition" | "SequencedTransition"
  | "JumpingTransition" | "CurvedTransition" | "EntryExitTransition";

const LayoutPresetSchema = z.enum([
  "LinearTransition", "FadingTransition", "SequencedTransition",
  "JumpingTransition", "CurvedTransition", "EntryExitTransition",
]);

export type EnteringAnimation = {
  preset: EnteringPreset;
  duration?: number;
  delay?: number;
  easing?: AnimationEasing;
  spring?: SpringConfig;
};

const EnteringAnimationSchema = z.object({
  preset: EnteringPresetSchema,
  duration: z.number().min(0).optional(),
  delay: z.number().min(0).optional(),
  easing: AnimationEasingSchema.optional(),
  spring: SpringConfigSchema.optional(),
});

export type ExitingAnimation = {
  preset: ExitingPreset;
  duration?: number;
  delay?: number;
  easing?: AnimationEasing;
  spring?: SpringConfig;
};

const ExitingAnimationSchema = z.object({
  preset: ExitingPresetSchema,
  duration: z.number().min(0).optional(),
  delay: z.number().min(0).optional(),
  easing: AnimationEasingSchema.optional(),
  spring: SpringConfigSchema.optional(),
});

export type LayoutAnimation = {
  preset: LayoutPreset;
  duration?: number;
  spring?: SpringConfig;
};

const LayoutAnimationSchema = z.object({
  preset: LayoutPresetSchema,
  duration: z.number().min(0).optional(),
  spring: SpringConfigSchema.optional(),
});

// Continuous looping effects — the one piece not named after a reanimated
// builder. Rendered imperatively with `withRepeat` over `withTiming`.
export type EffectPreset = "pulse" | "fade" | "rotate" | "shimmer" | "bounce";

const EffectPresetSchema = z.enum(["pulse", "fade", "rotate", "shimmer", "bounce"]);

export type ElementEffect = {
  preset: EffectPreset;
  duration?: number;
  delay?: number;
  easing?: AnimationEasing;
  loop?: boolean;
  /** pulse: scale bounds (default 0.95 / 1.05). */
  minScale?: number;
  maxScale?: number;
  /** fade: lower opacity bound (default 0.4). */
  minOpacity?: number;
  /** rotate: sweep in degrees (default 360). */
  degrees?: number;
};

const EffectSchema = z.object({
  preset: EffectPresetSchema,
  duration: z.number().min(0).optional(),
  delay: z.number().min(0).optional(),
  easing: AnimationEasingSchema.optional(),
  loop: z.boolean().optional(),
  minScale: z.number().positive().optional(),
  maxScale: z.number().positive().optional(),
  minOpacity: z.number().min(0).max(1).optional(),
  degrees: z.number().optional(),
});

export type ElementAnimation = {
  entering?: EnteringAnimation;
  exiting?: ExitingAnimation;
  layout?: LayoutAnimation;
  effect?: ElementEffect;
};

const ElementAnimationSchema = z.object({
  entering: EnteringAnimationSchema.optional(),
  exiting: ExitingAnimationSchema.optional(),
  layout: LayoutAnimationSchema.optional(),
  effect: EffectSchema.optional(),
});

// Static transform surface — also what `effect` animates at runtime.
export type ElementTransform = {
  translateX?: number;
  translateY?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  /** degrees */
  rotate?: number;
};

const TransformSchema = z.object({
  translateX: z.number().optional(),
  translateY: z.number().optional(),
  scale: z.number().optional(),
  scaleX: z.number().optional(),
  scaleY: z.number().optional(),
  rotate: z.number().optional(),
});

export type BaseBoxProps = {
  width?: number | string;
  height?: number | string;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  flex?: number;
  flexShrink?: number;
  flexGrow?: number;
  aspectRatio?: number;
  alignSelf?: "auto" | "flex-start" | "flex-end" | "center" | "stretch" | "baseline";
  opacity?: number;
  backgroundColor?: string;
  backgroundGradient?: GradientBackground;
  overflow?: "hidden" | "visible" | "scroll";
  margin?: number;
  marginHorizontal?: number;
  marginVertical?: number;
  padding?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;
  borderWidth?: number;
  borderRadius?: number;
  borderColor?: string;
  shadowColor?: string;
  shadowOffset?: ShadowOffset;
  shadowOpacity?: number;
  shadowRadius?: number;
  elevation?: number;
  transform?: ElementTransform;
  animation?: ElementAnimation;
};

export const BaseBoxPropsSchema = z.object({
  width: z.union([z.number().min(0), z.string()]).optional(),
  height: z.union([z.number().min(0), z.string()]).optional(),
  minWidth: z.number().min(0).optional(),
  maxWidth: z.number().min(0).optional(),
  minHeight: z.number().min(0).optional(),
  maxHeight: z.number().min(0).optional(),
  flex: z.number().min(0).optional(),
  flexShrink: z.number().min(0).optional(),
  flexGrow: z.number().min(0).optional(),
  aspectRatio: z.number().positive().optional(),
  alignSelf: z.enum(["auto", "flex-start", "flex-end", "center", "stretch", "baseline"]).optional(),
  opacity: z.number().min(0).max(1).optional(),
  backgroundColor: z.string().optional(),
  backgroundGradient: GradientBackgroundSchema.optional(),
  overflow: z.enum(["hidden", "visible", "scroll"]).optional(),
  margin: z.number().optional(),
  marginHorizontal: z.number().optional(),
  marginVertical: z.number().optional(),
  padding: z.number().min(0).optional(),
  paddingHorizontal: z.number().min(0).optional(),
  paddingVertical: z.number().min(0).optional(),
  borderWidth: z.number().min(0).optional(),
  borderRadius: z.number().min(0).optional(),
  borderColor: z.string().optional(),
  shadowColor: z.string().optional(),
  shadowOffset: ShadowOffsetSchema.optional(),
  shadowOpacity: z.number().min(0).max(1).optional(),
  shadowRadius: z.number().min(0).optional(),
  elevation: z.number().min(0).optional(),
  transform: TransformSchema.optional(),
  animation: ElementAnimationSchema.optional(),
});
