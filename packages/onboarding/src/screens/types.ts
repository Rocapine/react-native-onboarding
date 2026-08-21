import { z } from "zod";
import {
  type LeafCondition,
  type ConditionGroup,
  LeafConditionSchema,
  ConditionGroupSchema,
} from "../steps/common.types";
import { type StackElementProps, StackElementPropsSchema } from "./elements/StackElement";
import { type TextElementProps, TextElementPropsSchema } from "./elements/TextElement";
import { type RichTextElementProps, RichTextElementPropsSchema } from "./elements/RichTextElement";
import { type ImageElementProps, ImageElementPropsSchema } from "./elements/ImageElement";
import {
  type ProgressiveBlurImageElementProps,
  ProgressiveBlurImageElementPropsSchema,
} from "./elements/ProgressiveBlurImageElement";
import { type LottieElementProps, LottieElementPropsSchema } from "./elements/LottieElement";
import { type RiveElementProps, RiveElementPropsSchema } from "./elements/RiveElement";
import { type IconElementProps, IconElementPropsSchema } from "./elements/IconElement";
import { type VideoElementProps, VideoElementPropsSchema } from "./elements/VideoElement";
import { type InputElementProps, InputElementPropsSchema } from "./elements/InputElement";
import { type ButtonElementProps, ButtonElementPropsSchema } from "./elements/ButtonElement";
import { type RadioGroupElementProps, RadioGroupElementPropsSchema } from "./elements/RadioGroupElement";
import { type CheckboxGroupElementProps, CheckboxGroupElementPropsSchema } from "./elements/CheckboxGroupElement";
import { type DatePickerElementProps, DatePickerElementPropsSchema } from "./elements/DatePickerElement";
import { type WheelPickerElementProps, WheelPickerElementPropsSchema } from "./elements/WheelPickerElement";
import { type CarouselElementProps, CarouselElementPropsSchema } from "./elements/CarouselElement";
import { type RepeatElementProps, RepeatElementPropsSchema } from "./elements/RepeatElement";
import { type ZStackElementProps, ZStackElementPropsSchema } from "./elements/ZStackElement";
import { type SafeAreaViewElementProps, SafeAreaViewElementPropsSchema } from "./elements/SafeAreaViewElement";
import { type ScrollViewElementProps, ScrollViewElementPropsSchema } from "./elements/ScrollViewElement";
import {
  type KeyboardAvoidingViewElementProps,
  KeyboardAvoidingViewElementPropsSchema,
} from "./elements/KeyboardAvoidingViewElement";
import { type ProgressIndicatorElementProps, ProgressIndicatorElementPropsSchema } from "./elements/ProgressIndicatorElement";
import { type AnimatedTextElementProps, AnimatedTextElementPropsSchema } from "./elements/AnimatedTextElement";
import { type TypewriterTextElementProps, TypewriterTextElementPropsSchema } from "./elements/TypewriterTextElement";
import { type DrawingPadElementProps, DrawingPadElementPropsSchema } from "./elements/DrawingPadElement";
import { type SliderElementProps, SliderElementPropsSchema } from "./elements/SliderElement";

export type { BaseBoxProps, GradientBackground, GradientEdge, GradientStop, LinearGradientConfig } from "./elements/BaseBoxProps";
export type {
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
} from "./elements/BaseBoxProps";
export { BaseBoxPropsSchema, GradientBackgroundSchema } from "./elements/BaseBoxProps";
export type { StackElementProps } from "./elements/StackElement";
export type { TextElementProps, TextSpan } from "./elements/TextElement";
export { TextSpanSchema } from "./elements/TextElement";
export type { RichTextElementProps } from "./elements/RichTextElement";
export type { ImageElementProps } from "./elements/ImageElement";
export type {
  ProgressiveBlurImageElementProps,
  BlurMask,
  LinearBlurMask,
  RadialBlurMask,
  BlurMaskStop,
  BlurAppear,
} from "./elements/ProgressiveBlurImageElement";
export type { LottieElementProps } from "./elements/LottieElement";
export type { RiveElementProps } from "./elements/RiveElement";
export type { IconElementProps } from "./elements/IconElement";
export type { VideoElementProps } from "./elements/VideoElement";
export type { InputElementProps } from "./elements/InputElement";
export type { ButtonElementProps, ButtonAction, CustomButtonAction, SetVariableButtonAction } from "./elements/ButtonElement";
export { ButtonActionSchema, CustomButtonActionSchema, SetVariableButtonActionSchema } from "./elements/ButtonElement";
export type { RadioGroupElementProps } from "./elements/RadioGroupElement";
export type { CheckboxGroupElementProps } from "./elements/CheckboxGroupElement";
export type { DatePickerElementProps } from "./elements/DatePickerElement";
export type { WheelPickerElementProps, WheelPickerItem, WheelPickerRange } from "./elements/WheelPickerElement";
export { WheelPickerElementPropsSchema, generateWheelPickerRangeItems, resolveWheelPickerItems } from "./elements/WheelPickerElement";
export type { CarouselElementProps } from "./elements/CarouselElement";
export type { RepeatElementProps } from "./elements/RepeatElement";
export type { ZStackElementProps } from "./elements/ZStackElement";
export type { SafeAreaViewElementProps, SafeAreaEdge, SafeAreaEdgeMode } from "./elements/SafeAreaViewElement";
export type { ScrollViewElementProps, ScrollViewContentInset } from "./elements/ScrollViewElement";
export type {
  KeyboardAvoidingViewElementProps,
  KeyboardAvoidingBehavior,
} from "./elements/KeyboardAvoidingViewElement";
export type { ProgressIndicatorElementProps, ProgressEasing } from "./elements/ProgressIndicatorElement";
export type { AnimatedTextElementProps } from "./elements/AnimatedTextElement";
export type { TypewriterTextElementProps } from "./elements/TypewriterTextElement";
export type { DrawingPadElementProps } from "./elements/DrawingPadElement";
export type { SliderElementProps } from "./elements/SliderElement";

/**
 * Type tag for a ComposableScreen variable. Drives expression-mode coercion
 * in `setVariable` action evaluation (int/float math vs string concat).
 */
export type ComposableVariableKind = "int" | "float" | "string";

/**
 * A variable entry stored in the ComposableScreen variables map.
 * `value` is the canonical value (always a string), `label` is an optional
 * display label, `kind` optionally tags the underlying type.
 */
export type ComposableVariableEntry = {
  value: string;
  label?: string;
  kind?: ComposableVariableKind;
};

// UIElement union — must live here (not in elements/) to avoid circular deps
// because the Stack variant's children: UIElement[] references itself.
export type UIElement =
  | {
      id: string;
      name?: string;
      renderWhen?: LeafCondition | ConditionGroup;
      type: "YStack" | "XStack";
      props: StackElementProps;
      children: UIElement[];
    }
  | {
      id: string;
      name?: string;
      renderWhen?: LeafCondition | ConditionGroup;
      type: "Text";
      props: TextElementProps;
    }
  | {
      id: string;
      name?: string;
      renderWhen?: LeafCondition | ConditionGroup;
      type: "RichText";
      props: RichTextElementProps;
      children: Array<Extract<UIElement, { type: "Text" }>>;
    }
  | {
      id: string;
      name?: string;
      renderWhen?: LeafCondition | ConditionGroup;
      type: "Image";
      props: ImageElementProps;
    }
  | {
      id: string;
      name?: string;
      renderWhen?: LeafCondition | ConditionGroup;
      type: "ProgressiveBlurImage";
      props: ProgressiveBlurImageElementProps;
    }
  | {
      id: string;
      name?: string;
      renderWhen?: LeafCondition | ConditionGroup;
      type: "Lottie";
      props: LottieElementProps;
    }
  | {
      id: string;
      name?: string;
      renderWhen?: LeafCondition | ConditionGroup;
      type: "Rive";
      props: RiveElementProps;
    }
  | {
      id: string;
      name?: string;
      renderWhen?: LeafCondition | ConditionGroup;
      type: "Icon";
      props: IconElementProps;
    }
  | {
      id: string;
      name?: string;
      renderWhen?: LeafCondition | ConditionGroup;
      type: "Video";
      props: VideoElementProps;
    }
  | {
      id: string;
      name?: string;
      renderWhen?: LeafCondition | ConditionGroup;
      type: "Input";
      props: InputElementProps;
    }
  | {
      id: string;
      name?: string;
      renderWhen?: LeafCondition | ConditionGroup;
      type: "Button";
      props: ButtonElementProps;
    }
  | {
      id: string;
      name?: string;
      renderWhen?: LeafCondition | ConditionGroup;
      type: "RadioGroup";
      props: RadioGroupElementProps;
    }
  | {
      id: string;
      name?: string;
      renderWhen?: LeafCondition | ConditionGroup;
      type: "CheckboxGroup";
      props: CheckboxGroupElementProps;
    }
  | {
      id: string;
      name?: string;
      renderWhen?: LeafCondition | ConditionGroup;
      type: "DatePicker";
      props: DatePickerElementProps;
    }
  | {
      id: string;
      name?: string;
      renderWhen?: LeafCondition | ConditionGroup;
      type: "WheelPicker";
      props: WheelPickerElementProps;
    }
  | {
      id: string;
      name?: string;
      renderWhen?: LeafCondition | ConditionGroup;
      type: "Carousel";
      props: CarouselElementProps;
      children: UIElement[];
    }
  | {
      id: string;
      name?: string;
      renderWhen?: LeafCondition | ConditionGroup;
      type: "Repeat";
      props: RepeatElementProps;
      children: UIElement[];
    }
  | {
      id: string;
      name?: string;
      renderWhen?: LeafCondition | ConditionGroup;
      type: "ZStack";
      props: ZStackElementProps;
      children: UIElement[];
    }
  | {
      id: string;
      name?: string;
      renderWhen?: LeafCondition | ConditionGroup;
      type: "SafeAreaView";
      props: SafeAreaViewElementProps;
      children: UIElement[];
    }
  | {
      id: string;
      name?: string;
      renderWhen?: LeafCondition | ConditionGroup;
      type: "ScrollView";
      props: ScrollViewElementProps;
      children: UIElement[];
    }
  | {
      id: string;
      name?: string;
      renderWhen?: LeafCondition | ConditionGroup;
      type: "KeyboardAvoidingView";
      props: KeyboardAvoidingViewElementProps;
      children: UIElement[];
    }
  | {
      id: string;
      name?: string;
      renderWhen?: LeafCondition | ConditionGroup;
      type: "ProgressIndicator";
      props: ProgressIndicatorElementProps;
    }
  | {
      id: string;
      name?: string;
      renderWhen?: LeafCondition | ConditionGroup;
      type: "AnimatedText";
      props: AnimatedTextElementProps;
    }
  | {
      id: string;
      name?: string;
      renderWhen?: LeafCondition | ConditionGroup;
      type: "TypewriterText";
      props: TypewriterTextElementProps;
    }
  | {
      id: string;
      name?: string;
      renderWhen?: LeafCondition | ConditionGroup;
      type: "DrawingPad";
      props: DrawingPadElementProps;
    }
  | {
      id: string;
      name?: string;
      renderWhen?: LeafCondition | ConditionGroup;
      type: "Slider";
      props: SliderElementProps;
    };

// The `Text` variant, extracted so `RichText` can restrict its children to
// Text-only (children: z.array(TextUIElementSchema)) while the union references
// the same object.
const TextUIElementSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  renderWhen: z.union([LeafConditionSchema, ConditionGroupSchema]).optional(),
  type: z.literal("Text"),
  props: TextElementPropsSchema,
});

// DISCRIMINATED on `type`, not a plain union — this is load-bearing for more
// than speed. A plain `z.union` of these ~25 recursive variants has to try
// every branch at every node, and each container branch re-parses the whole
// subtree on the way, so any shape that misses on all of them costs
// exponential time and memory rather than linear. Three observed consequences,
// all of them crashes rather than validation errors:
//
//  - a real 52-node paywall with every `id` stripped exhausted a 512 MB heap
//    in ~10s ("Ineffective mark-compacts near heap limit") instead of
//    reporting a missing `id`. `PaywallHost` parses serve-path payloads
//    deliberately outside its error boundary — and a boundary cannot catch an
//    OOM anyway — so that was an app-kill vector reachable from data.
//  - a single container missing its `children` key threw
//    `RangeError: Invalid string length` from `JSON.stringify` INSIDE zod's own
//    error constructor: the error object was too large to build, so nothing
//    could report it.
//  - even when it did return, the top-level issue was always `invalid_union` /
//    "Invalid input" at the array index, with the real cause buried under 25
//    nested branch errors — which is why callers saw `0: Invalid input`.
//
// Note `id` being REQUIRED on every variant is what made the first case
// maximal rather than mild: a missing `id` misses every branch at every node.
// So "make `id` required and fail fast" cannot work — a required field has no
// way to fail fast inside a non-discriminated union. The discriminator is the
// fix, and it makes all three cases return in ~0ms with the exact path.
//
// Consequence for maintainers: every variant needs exactly ONE literal `type`.
// That is why YStack and XStack are two entries below sharing one props
// schema, rather than one entry with `z.union([literal, literal])` — a
// discriminated union cannot key off a union of literals.
export const UIElementSchema: z.ZodType<UIElement> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({
      id: z.string(),
      name: z.string().optional(),
      renderWhen: z.union([LeafConditionSchema, ConditionGroupSchema]).optional(),
      type: z.literal("YStack"),
      props: StackElementPropsSchema,
      children: z.array(UIElementSchema),
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      renderWhen: z.union([LeafConditionSchema, ConditionGroupSchema]).optional(),
      type: z.literal("XStack"),
      props: StackElementPropsSchema,
      children: z.array(UIElementSchema),
    }),
    TextUIElementSchema,
    z.object({
      id: z.string(),
      name: z.string().optional(),
      renderWhen: z.union([LeafConditionSchema, ConditionGroupSchema]).optional(),
      type: z.literal("RichText"),
      props: RichTextElementPropsSchema,
      children: z.array(TextUIElementSchema),
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      renderWhen: z.union([LeafConditionSchema, ConditionGroupSchema]).optional(),
      type: z.literal("Image"),
      props: ImageElementPropsSchema,
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      renderWhen: z.union([LeafConditionSchema, ConditionGroupSchema]).optional(),
      type: z.literal("ProgressiveBlurImage"),
      props: ProgressiveBlurImageElementPropsSchema,
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      renderWhen: z.union([LeafConditionSchema, ConditionGroupSchema]).optional(),
      type: z.literal("Lottie"),
      props: LottieElementPropsSchema,
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      renderWhen: z.union([LeafConditionSchema, ConditionGroupSchema]).optional(),
      type: z.literal("Rive"),
      props: RiveElementPropsSchema,
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      renderWhen: z.union([LeafConditionSchema, ConditionGroupSchema]).optional(),
      type: z.literal("Icon"),
      props: IconElementPropsSchema,
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      renderWhen: z.union([LeafConditionSchema, ConditionGroupSchema]).optional(),
      type: z.literal("Video"),
      props: VideoElementPropsSchema,
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      renderWhen: z.union([LeafConditionSchema, ConditionGroupSchema]).optional(),
      type: z.literal("Input"),
      props: InputElementPropsSchema,
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      renderWhen: z.union([LeafConditionSchema, ConditionGroupSchema]).optional(),
      type: z.literal("Button"),
      props: ButtonElementPropsSchema,
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      renderWhen: z.union([LeafConditionSchema, ConditionGroupSchema]).optional(),
      type: z.literal("RadioGroup"),
      props: RadioGroupElementPropsSchema,
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      renderWhen: z.union([LeafConditionSchema, ConditionGroupSchema]).optional(),
      type: z.literal("CheckboxGroup"),
      props: CheckboxGroupElementPropsSchema,
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      renderWhen: z.union([LeafConditionSchema, ConditionGroupSchema]).optional(),
      type: z.literal("DatePicker"),
      props: DatePickerElementPropsSchema,
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      renderWhen: z.union([LeafConditionSchema, ConditionGroupSchema]).optional(),
      type: z.literal("WheelPicker"),
      props: WheelPickerElementPropsSchema,
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      renderWhen: z.union([LeafConditionSchema, ConditionGroupSchema]).optional(),
      type: z.literal("Carousel"),
      props: CarouselElementPropsSchema,
      children: z.array(UIElementSchema),
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      renderWhen: z.union([LeafConditionSchema, ConditionGroupSchema]).optional(),
      type: z.literal("Repeat"),
      props: RepeatElementPropsSchema,
      children: z.array(UIElementSchema),
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      renderWhen: z.union([LeafConditionSchema, ConditionGroupSchema]).optional(),
      type: z.literal("ZStack"),
      props: ZStackElementPropsSchema,
      children: z.array(UIElementSchema),
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      renderWhen: z.union([LeafConditionSchema, ConditionGroupSchema]).optional(),
      type: z.literal("SafeAreaView"),
      props: SafeAreaViewElementPropsSchema,
      children: z.array(UIElementSchema),
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      renderWhen: z.union([LeafConditionSchema, ConditionGroupSchema]).optional(),
      type: z.literal("ScrollView"),
      props: ScrollViewElementPropsSchema,
      children: z.array(UIElementSchema),
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      renderWhen: z.union([LeafConditionSchema, ConditionGroupSchema]).optional(),
      type: z.literal("KeyboardAvoidingView"),
      props: KeyboardAvoidingViewElementPropsSchema,
      children: z.array(UIElementSchema),
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      renderWhen: z.union([LeafConditionSchema, ConditionGroupSchema]).optional(),
      type: z.literal("ProgressIndicator"),
      props: ProgressIndicatorElementPropsSchema,
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      renderWhen: z.union([LeafConditionSchema, ConditionGroupSchema]).optional(),
      type: z.literal("AnimatedText"),
      props: AnimatedTextElementPropsSchema,
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      renderWhen: z.union([LeafConditionSchema, ConditionGroupSchema]).optional(),
      type: z.literal("TypewriterText"),
      props: TypewriterTextElementPropsSchema,
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      renderWhen: z.union([LeafConditionSchema, ConditionGroupSchema]).optional(),
      type: z.literal("DrawingPad"),
      props: DrawingPadElementPropsSchema,
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      renderWhen: z.union([LeafConditionSchema, ConditionGroupSchema]).optional(),
      type: z.literal("Slider"),
      props: SliderElementPropsSchema,
    }),
  ])
);

// Walk a UIElement tree; flag any KeyboardAvoidingView descendant of another KeyboardAvoidingView.
// RN behavior is undefined when a KAV nests another; KAV adjusts the layout of the host view, and
// stacking adjusters produces drift and clip artifacts on iOS + double height insets on Android.
const collectNestedKeyboardAvoidingViews = (
  nodes: UIElement[],
  insideKav: boolean,
  out: string[]
): void => {
  for (const node of nodes) {
    if (node.type === "KeyboardAvoidingView") {
      if (insideKav) out.push(node.id);
      collectNestedKeyboardAvoidingViews(node.children, true, out);
      continue;
    }
    if (
      node.type === "YStack" ||
      node.type === "XStack" ||
      node.type === "ZStack" ||
      node.type === "SafeAreaView" ||
      node.type === "ScrollView" ||
      node.type === "Carousel"
    ) {
      collectNestedKeyboardAvoidingViews(node.children, insideKav, out);
    }
  }
};

/**
 * The elements array of any composable screen — an onboarding step payload, a
 * paywall, or anything else built on this engine. Carries the nested-
 * KeyboardAvoidingView refinement that used to live on the step payload schema,
 * because the constraint is a property of the element tree, not of steps.
 */
export const ScreenElementsSchema = z
  .array(UIElementSchema)
  .superRefine((elements, ctx) => {
    const offenders: string[] = [];
    collectNestedKeyboardAvoidingViews(elements, false, offenders);
    for (const id of offenders) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [],
        message: `KeyboardAvoidingView (id="${id}") cannot be nested inside another KeyboardAvoidingView.`,
      });
    }
  });
