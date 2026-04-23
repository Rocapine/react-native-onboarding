import React from "react";
import { UIElement } from "../types";
import { RenderContext } from "./shared";
import { StackElementComponent } from "./StackElement";
import { TextElementComponent } from "./TextElement";
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

export const renderElement = (
  element: UIElement,
  ctx: RenderContext,
  parentType?: "XStack" | "YStack"
): React.ReactNode => {
  if (element.type === "YStack" || element.type === "XStack") {
    return <StackElementComponent key={element.id} element={element} ctx={ctx} parentType={parentType} />;
  }

  if (element.type === "Text") {
    return <TextElementComponent key={element.id} element={element} ctx={ctx} parentType={parentType} />;
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

  return null;
};
