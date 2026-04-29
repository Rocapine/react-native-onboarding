import { z } from "zod";
import { BaseStepTypeSchema } from "../common.types";
import { type StackElementProps, StackElementPropsSchema } from "./elements/StackElement";
import { type TextElementProps, TextElementPropsSchema } from "./elements/TextElement";
import { type ImageElementProps, ImageElementPropsSchema } from "./elements/ImageElement";
import { type LottieElementProps, LottieElementPropsSchema } from "./elements/LottieElement";
import { type RiveElementProps, RiveElementPropsSchema } from "./elements/RiveElement";
import { type IconElementProps, IconElementPropsSchema } from "./elements/IconElement";
import { type VideoElementProps, VideoElementPropsSchema } from "./elements/VideoElement";
import { type InputElementProps, InputElementPropsSchema } from "./elements/InputElement";
import { type ButtonElementProps, ButtonElementPropsSchema } from "./elements/ButtonElement";
import { type RadioGroupElementProps, RadioGroupElementPropsSchema } from "./elements/RadioGroupElement";
import { type CheckboxGroupElementProps, CheckboxGroupElementPropsSchema } from "./elements/CheckboxGroupElement";
import { type DatePickerElementProps, DatePickerElementPropsSchema } from "./elements/DatePickerElement";
import { type CarouselElementProps, CarouselElementPropsSchema } from "./elements/CarouselElement";
import { type ZStackElementProps, ZStackElementPropsSchema } from "./elements/ZStackElement";
import { type SafeAreaViewElementProps, SafeAreaViewElementPropsSchema } from "./elements/SafeAreaViewElement";

export type { BaseBoxProps, GradientBackground, GradientEdge, GradientStop, LinearGradientConfig } from "./elements/BaseBoxProps";
export { BaseBoxPropsSchema, GradientBackgroundSchema } from "./elements/BaseBoxProps";
export type { StackElementProps } from "./elements/StackElement";
export type { TextElementProps } from "./elements/TextElement";
export type { ImageElementProps } from "./elements/ImageElement";
export type { LottieElementProps } from "./elements/LottieElement";
export type { RiveElementProps } from "./elements/RiveElement";
export type { IconElementProps } from "./elements/IconElement";
export type { VideoElementProps } from "./elements/VideoElement";
export type { InputElementProps } from "./elements/InputElement";
export type { ButtonElementProps } from "./elements/ButtonElement";
export type { RadioGroupElementProps } from "./elements/RadioGroupElement";
export type { CheckboxGroupElementProps } from "./elements/CheckboxGroupElement";
export type { DatePickerElementProps } from "./elements/DatePickerElement";
export type { CarouselElementProps } from "./elements/CarouselElement";
export type { ZStackElementProps } from "./elements/ZStackElement";
export type { SafeAreaViewElementProps, SafeAreaEdge, SafeAreaEdgeMode } from "./elements/SafeAreaViewElement";

// UIElement union — must live here (not in elements/) to avoid circular deps
// because the Stack variant's children: UIElement[] references itself.
type UIElement =
  | {
      id: string;
      name?: string;
      type: "YStack" | "XStack";
      props: StackElementProps;
      children: UIElement[];
    }
  | {
      id: string;
      name?: string;
      type: "Text";
      props: TextElementProps;
    }
  | {
      id: string;
      name?: string;
      type: "Image";
      props: ImageElementProps;
    }
  | {
      id: string;
      name?: string;
      type: "Lottie";
      props: LottieElementProps;
    }
  | {
      id: string;
      name?: string;
      type: "Rive";
      props: RiveElementProps;
    }
  | {
      id: string;
      name?: string;
      type: "Icon";
      props: IconElementProps;
    }
  | {
      id: string;
      name?: string;
      type: "Video";
      props: VideoElementProps;
    }
  | {
      id: string;
      name?: string;
      type: "Input";
      props: InputElementProps;
    }
  | {
      id: string;
      name?: string;
      type: "Button";
      props: ButtonElementProps;
    }
  | {
      id: string;
      name?: string;
      type: "RadioGroup";
      props: RadioGroupElementProps;
    }
  | {
      id: string;
      name?: string;
      type: "CheckboxGroup";
      props: CheckboxGroupElementProps;
    }
  | {
      id: string;
      name?: string;
      type: "DatePicker";
      props: DatePickerElementProps;
    }
  | {
      id: string;
      name?: string;
      type: "Carousel";
      props: CarouselElementProps;
      children: UIElement[];
    }
  | {
      id: string;
      name?: string;
      type: "ZStack";
      props: ZStackElementProps;
      children: UIElement[];
    }
  | {
      id: string;
      name?: string;
      type: "SafeAreaView";
      props: SafeAreaViewElementProps;
      children: UIElement[];
    };

const UIElementSchema: z.ZodType<UIElement> = z.lazy(() =>
  z.union([
    z.object({
      id: z.string(),
      name: z.string().optional(),
      type: z.union([z.literal("YStack"), z.literal("XStack")]),
      props: StackElementPropsSchema,
      children: z.array(UIElementSchema),
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      type: z.literal("Text"),
      props: TextElementPropsSchema,
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      type: z.literal("Image"),
      props: ImageElementPropsSchema,
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      type: z.literal("Lottie"),
      props: LottieElementPropsSchema,
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      type: z.literal("Rive"),
      props: RiveElementPropsSchema,
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      type: z.literal("Icon"),
      props: IconElementPropsSchema,
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      type: z.literal("Video"),
      props: VideoElementPropsSchema,
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      type: z.literal("Input"),
      props: InputElementPropsSchema,
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      type: z.literal("Button"),
      props: ButtonElementPropsSchema,
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      type: z.literal("RadioGroup"),
      props: RadioGroupElementPropsSchema,
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      type: z.literal("CheckboxGroup"),
      props: CheckboxGroupElementPropsSchema,
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      type: z.literal("DatePicker"),
      props: DatePickerElementPropsSchema,
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      type: z.literal("Carousel"),
      props: CarouselElementPropsSchema,
      children: z.array(UIElementSchema),
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      type: z.literal("ZStack"),
      props: ZStackElementPropsSchema,
      children: z.array(UIElementSchema),
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      type: z.literal("SafeAreaView"),
      props: SafeAreaViewElementPropsSchema,
      children: z.array(UIElementSchema),
    }),
  ])
);

export const ComposableScreenStepPayloadSchema = z.object({
  elements: z.array(UIElementSchema),
});

export const ComposableScreenStepTypeSchema = BaseStepTypeSchema.extend({
  type: z.literal("ComposableScreen"),
  payload: ComposableScreenStepPayloadSchema,
});

export type ComposableScreenStepType = z.infer<typeof ComposableScreenStepTypeSchema>;
