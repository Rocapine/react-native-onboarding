import React from "react";
import { Pressable } from "react-native";
import { evaluateCondition } from "@rocapine/react-native-onboarding";
import { UIElement } from "../types";
import { BaseBoxProps } from "./BaseBoxProps";
import { RenderContext } from "./shared";
import { runActions } from "./runActions";
import { StackElementComponent } from "./StackElement";
import { TextElementComponent } from "./TextElement";
import { RichTextElementComponent } from "./RichTextElement";
import { ImageElementComponent } from "./ImageElement";
import { ProgressiveBlurImageElementComponent } from "./ProgressiveBlurImageElement";
import { LottieElementComponent } from "./LottieElement";
import { RiveElementRenderer } from "./RiveElement";
import { IconElementComponent } from "./IconElement";
import { VideoElementRenderer } from "./VideoElement";
import { InputElementComponent } from "./InputElement";
import { RadioGroupComponent } from "./RadioGroupElement";
import { CheckboxGroupComponent } from "./CheckboxGroupElement";
import { ButtonElementComponent } from "./ButtonElement";
import { DatePickerElementComponent } from "./DatePickerElement";
import { WheelPickerElementComponent } from "./WheelPickerElement";
import { CarouselElementComponent } from "./CarouselElement";
import { ZStackElementComponent } from "./ZStackElement";
import { SafeAreaViewElementComponent } from "./SafeAreaViewElement";
import { ScrollViewElementComponent } from "./ScrollViewElement";
import { KeyboardAvoidingViewElementComponent } from "./KeyboardAvoidingViewElement";
import { ProgressIndicatorElementComponent } from "./ProgressIndicatorElement";
import { AnimatedTextElementComponent } from "./AnimatedTextElement";
import { DrawingPadElementComponent } from "./DrawingPadElement";
import { SliderElementComponent } from "./SliderElement";
import { AnimatedBox } from "./AnimatedBox";

// Element types that own their own press / focus / scroll handling. The generic
// `onPress` (BaseBoxProps) is NOT wired for these — Button/RadioGroup/Checkbox/
// DatePicker already dispatch actions or selections; Input/WheelPicker would have
// their focus / scroll-selection intercepted by an outer Pressable.
const PRESS_HANDLED_TYPES = new Set<UIElement["type"]>([
  "Button",
  "RadioGroup",
  "CheckboxGroup",
  "DatePicker",
  "Input",
  "WheelPicker",
  "DrawingPad",
  "Slider",
]);

export const renderElement = (
  element: UIElement,
  ctx: RenderContext,
  parentType?: "XStack" | "YStack" | "ZStack" | "RichText" | "XScroll"
): React.ReactNode => {
  if (element.renderWhen) {
    if (!evaluateCondition(element.renderWhen, ctx.flatVariables)) return null;
  }

  // Dispatch to the concrete element renderer. Captured into `node` so a single
  // AnimatedBox wrapper can apply animation/transform to any of the 15 types.
  const node = ((): React.ReactNode => {
  if (element.type === "YStack" || element.type === "XStack") {
    return <StackElementComponent key={element.id} element={element} ctx={ctx} parentType={parentType} />;
  }

  if (element.type === "Text") {
    return <TextElementComponent key={element.id} element={element} ctx={ctx} parentType={parentType} />;
  }

  if (element.type === "RichText") {
    return <RichTextElementComponent key={element.id} element={element} ctx={ctx} parentType={parentType} />;
  }

  if (element.type === "Image") {
    return <ImageElementComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "ProgressiveBlurImage") {
    return <ProgressiveBlurImageElementComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "Lottie") {
    return <LottieElementComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "Rive") {
    return <RiveElementRenderer key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "Icon") {
    return <IconElementComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "Video") {
    return <VideoElementRenderer key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "Input") {
    return <InputElementComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "RadioGroup") {
    return <RadioGroupComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "CheckboxGroup") {
    return <CheckboxGroupComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "Button") {
    return <ButtonElementComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "DatePicker") {
    return <DatePickerElementComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "WheelPicker") {
    return <WheelPickerElementComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "Carousel") {
    return <CarouselElementComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "ZStack") {
    return <ZStackElementComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "SafeAreaView") {
    return <SafeAreaViewElementComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "ScrollView") {
    return <ScrollViewElementComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "KeyboardAvoidingView") {
    return <KeyboardAvoidingViewElementComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "ProgressIndicator") {
    return <ProgressIndicatorElementComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "AnimatedText") {
    return <AnimatedTextElementComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "DrawingPad") {
    return <DrawingPadElementComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "Slider") {
    return <SliderElementComponent key={element.id} element={element} ctx={ctx} />;
  }

    return null;
  })();

  // Cast to BaseBoxProps: not every element's props type extends it (e.g.
  // WheelPicker), but the onPress/animation/transform/flex/alignSelf fields are
  // all optional BaseBoxProps members and simply read as undefined when absent.
  const p = element.props as BaseBoxProps;

  // Generic onPress: make any non-pressable element tappable, dispatching the
  // same action list as Button via runActions. Skipped for PRESS_HANDLED_TYPES.
  // A Pressable around a scroll/carousel keeps inner scrolling working — RN's
  // gesture responder gives the scroll the touch when it pans.
  let content: React.ReactNode = node;
  if (
    content !== null &&
    p.onPress &&
    p.onPress.length > 0 &&
    !PRESS_HANDLED_TYPES.has(element.type)
  ) {
    const onPress = p.onPress;
    // The Pressable must be layout-transparent (like AnimatedBox): forward the
    // element's flex sizing so the wrapper participates in its parent's flex
    // context exactly as the element would. Without this, the style-less
    // Pressable sizes to content while the element's `flex`/`flexShrink` sit on
    // the inner node — breaking row splits (cards overflow) and column flow.
    // Mirror StackElement's `parentType === "XStack"` flexShrink:1 default.
    content = (
      <Pressable
        key={element.id}
        onPress={() => {
          void runActions(onPress, ctx);
        }}
        style={{
          flex: p.flex,
          flexGrow: p.flexGrow,
          flexShrink: p.flexShrink ?? (parentType === "XStack" ? 1 : undefined),
          alignSelf: p.alignSelf,
        }}
      >
        {content}
      </Pressable>
    );
  }

  // Wrap only when motion is requested — zero overhead (no extra view) otherwise.
  // Cast to BaseBoxProps: not every element's props type extends it (e.g.
  // WheelPicker), but the animation/transform/flex/alignSelf fields are all
  // optional BaseBoxProps members and simply read as undefined when absent.
  if (content !== null && (p.animation || p.transform)) {
    return (
      <AnimatedBox
        key={element.id}
        animation={p.animation}
        transform={p.transform}
        flex={p.flex}
        alignSelf={p.alignSelf}
      >
        {content}
      </AnimatedBox>
    );
  }

  return content;
};
