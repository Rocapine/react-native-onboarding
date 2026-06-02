import React from "react";
import { evaluateCondition } from "@rocapine/react-native-onboarding";
import { UIElement } from "../types";
import { BaseBoxProps } from "./BaseBoxProps";
import { RenderContext } from "./shared";
import { StackElementComponent } from "./StackElement";
import { TextElementComponent } from "./TextElement";
import { RichTextElementComponent } from "./RichTextElement";
import { ImageElementComponent } from "./ImageElement";
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
import { AnimatedBox } from "./AnimatedBox";

export const renderElement = (
  element: UIElement,
  ctx: RenderContext,
  parentType?: "XStack" | "YStack" | "ZStack" | "RichText" | "XScroll"
): React.ReactNode => {
  if (element.renderWhen) {
    const flatVars = Object.fromEntries(
      Object.entries(ctx.variables).map(([k, v]) => [k, v?.value])
    );
    if (!evaluateCondition(element.renderWhen, flatVars)) return null;
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

    return null;
  })();

  // Wrap only when motion is requested — zero overhead (no extra view) otherwise.
  // Cast to BaseBoxProps: not every element's props type extends it (e.g.
  // WheelPicker), but the animation/transform/flex/alignSelf fields are all
  // optional BaseBoxProps members and simply read as undefined when absent.
  const p = element.props as BaseBoxProps;
  if (node !== null && (p.animation || p.transform)) {
    return (
      <AnimatedBox
        key={element.id}
        animation={p.animation}
        transform={p.transform}
        flex={p.flex}
        alignSelf={p.alignSelf}
      >
        {node}
      </AnimatedBox>
    );
  }

  return node;
};
