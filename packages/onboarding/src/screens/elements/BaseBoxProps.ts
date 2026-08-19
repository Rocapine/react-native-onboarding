import { z } from "zod";
import { type ButtonAction, ButtonActionSchema } from "../../steps/common.types";

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

export type RadialGradientConfig = {
  type: "radial";
  // Center of the gradient as 0..1 fractions of the box (default { x: 0.5, y: 0.5 }).
  center?: { x: number; y: number };
  // Radius as a fraction of the box (objectBoundingBox units, default 0.75).
  radius?: number;
  stops: GradientStop[];
};

export type GradientBackground = LinearGradientConfig | RadialGradientConfig;

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
  z.object({
    type: z.literal("radial"),
    center: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
    radius: z.number().positive().optional(),
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

export const AnimationEasingSchema = z.enum(["linear", "ease-in", "ease-out", "ease-in-out"]);

// Mirrors reanimated's `.springify(config)` — only the fields it accepts.
// When `spring` is present it wins over `easing` (matches reanimated semantics).
export type SpringConfig = {
  damping?: number;
  stiffness?: number;
  mass?: number;
};

export const SpringConfigSchema = z.object({
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

export const EnteringPresetSchema = z.enum([
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
  /**
   * Play this entrance **exactly once per screen lifetime**, on the first render
   * where the element is visible.
   *
   * Exists because `renderWhen` visibility is mount/unmount — a false gate
   * returns `null` — and reanimated fires `entering` on mount. So a gated
   * element replays its entrance every single time the gate flips back to true:
   * swipe away from a carousel slide and back, and its decorations animate in
   * again. There is no payload-level fix (`gte` still unmounts when you swipe
   * backwards, and `replayWhen` is the exact opposite — it remounts on *every*
   * change), so the latch has to live here.
   *
   * If that first visible render is the screen's **initial mount**, the play is
   * DEFERRED until the screen has settled rather than suppressed. Deferring, not
   * vetoing, is the important half: an entrance that fires during the host's
   * push transition is half-consumed by it, and remote images may not have
   * decoded yet, so the user sees a partial reveal or none at all. Suppressing
   * would "fix" that by never animating, which is the bug rather than the fix.
   *
   * Subsequent visibility flips never replay. Ignored when `replayWhen` is also
   * set on the same element — the two ask for opposite things, and `once` wins.
   *
   * Default false (unchanged behaviour: every mount animates).
   */
  once?: boolean;
};

const EnteringAnimationSchema = z.object({
  preset: EnteringPresetSchema,
  duration: z.number().min(0).optional(),
  delay: z.number().min(0).optional(),
  easing: AnimationEasingSchema.optional(),
  spring: SpringConfigSchema.optional(),
  once: z.boolean().optional(),
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
  /**
   * Replay `entering` whenever the named variable's VALUE changes.
   *
   * Reanimated fires an `entering` builder on mount and never again, so without
   * this the only way to re-run an entrance is to unmount and remount the
   * element — which today means toggling `renderWhen`, i.e. you cannot replay
   * without also changing visibility. This covers the case where the element
   * stays on screen and should re-animate because something it depends on
   * changed (a recalculated total, the answer to the question above it).
   *
   * Mechanism, because it has a visible consequence: the element's subtree is
   * remounted (its React key is derived from the variable's value). Any
   * transient state inside it resets — an `Input`'s uncommitted text, a
   * `Carousel`'s scroll position — and a continuous `animation.effect` restarts.
   * Use it on presentational subtrees; avoid wrapping inputs in one.
   *
   * The first render is not a replay: the key only changes on a subsequent
   * write, so `entering` still fires exactly once on mount.
   */
  replayWhen?: string;
};

const ElementAnimationSchema = z.object({
  entering: EnteringAnimationSchema.optional(),
  exiting: ExitingAnimationSchema.optional(),
  layout: LayoutAnimationSchema.optional(),
  effect: EffectSchema.optional(),
  replayWhen: z.string().min(1).optional(),
});

// Declarative absolute placement for a ZStack child. Numbers are density-
// independent pixels; strings are percentages of the stack ("62.1%") — the same
// number|string convention `width`/`height` already use via `dim()`.
//
// ONLY honoured on a direct child of a `ZStack`, because that is the only
// container that absolutely-positions its children; elsewhere it is inert.
//
// A side you omit is NOT treated as 0 — it falls back to the ZStack's shared
// anchor for that axis, so partial placement works (`{ top: 40 }` pins vertically
// while still honouring the anchor horizontally). Supplying exactly one side per
// axis (`top` + `left`) leaves the child content-sized and pinned by that corner,
// which is what a drag-to-place gesture means; supplying BOTH sides of an axis
// resolves to a width/height instead, which stretches the child.
export type ElementInset = {
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
};

const InsetSide = z.union([z.number(), z.string()]);
const InsetSchema = z.object({
  top: InsetSide.optional(),
  left: InsetSide.optional(),
  right: InsetSide.optional(),
  bottom: InsetSide.optional(),
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
  /**
   * Declarative absolute placement inside a `ZStack` (ignored elsewhere).
   * Replaces doing the arithmetic by hand with `transform.translateX/Y`;
   * composes with `transform` rather than replacing it.
   */
  inset?: ElementInset;
  transform?: ElementTransform;
  animation?: ElementAnimation;
  /**
   * Ordered list of actions to run when the element is tapped. Same shape as
   * `Button.actions` — sequential, `"continue"` is terminal. Makes any element
   * pressable. Ignored for elements that own their own press/focus/scroll
   * handling (Button, RadioGroup, CheckboxGroup, DatePicker, Input, WheelPicker).
   */
  onPress?: ButtonAction[];
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
  inset: InsetSchema.optional(),
  transform: TransformSchema.optional(),
  animation: ElementAnimationSchema.optional(),
  onPress: z.array(ButtonActionSchema).optional(),
});
