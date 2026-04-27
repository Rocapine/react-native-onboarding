import React, { useState, useEffect } from "react";
import { z } from "zod";
import { View, TextInput } from "react-native";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { UIElement } from "../types";
import { RenderContext, dim } from "./shared";

export type InputElementProps = BaseBoxProps & {
  variableName?: string;
  placeholder?: string;
  defaultValue?: string;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad" | "decimal-pad" | "url" | "number-pad" | "ascii-capable" | "numbers-and-punctuation" | "name-phone-pad" | "twitter" | "web-search" | "visible-password";
  returnKeyType?: "done" | "next" | "go" | "search" | "send" | "default" | "emergency-call" | "google" | "join" | "route" | "yahoo" | "none" | "previous";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  secureTextEntry?: boolean;
  maxLength?: number;
  multiline?: boolean;
  numberOfLines?: number;
  editable?: boolean;
  color?: string;
  backgroundColor?: string;
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: "left" | "center" | "right";
  placeholderColor?: string;
};

export const InputElementPropsSchema = BaseBoxPropsSchema.extend({
  variableName: z.string().min(1).optional(),
  placeholder: z.string().optional(),
  defaultValue: z.string().optional(),
  keyboardType: z.enum(["default", "email-address", "numeric", "phone-pad", "decimal-pad", "url", "number-pad", "ascii-capable", "numbers-and-punctuation", "name-phone-pad", "twitter", "web-search", "visible-password"]).optional(),
  returnKeyType: z.enum(["done", "next", "go", "search", "send", "default", "emergency-call", "google", "join", "route", "yahoo", "none", "previous"]).optional(),
  autoCapitalize: z.enum(["none", "sentences", "words", "characters"]).optional(),
  secureTextEntry: z.boolean().optional(),
  maxLength: z.number().int().nonnegative().optional(),
  multiline: z.boolean().optional(),
  numberOfLines: z.number().int().nonnegative().optional(),
  editable: z.boolean().optional(),
  color: z.string().optional(),
  backgroundColor: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.string().optional(),
  fontFamily: z.string().optional(),
  lineHeight: z.number().optional(),
  letterSpacing: z.number().optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  placeholderColor: z.string().optional(),
});

type InputUIElement = Extract<UIElement, { type: "Input" }>;

type Props = {
  element: InputUIElement;
  ctx: RenderContext;
};

export const InputElementComponent = ({ element, ctx }: Props): React.ReactElement => {
  const { theme, variables, setVariable } = ctx;
  const persistedValue = element.props.variableName ? variables[element.props.variableName]?.value : undefined;
  const [value, setValue] = useState(persistedValue ?? element.props.defaultValue ?? "");

  useEffect(() => {
    if (element.props.variableName && element.props.defaultValue !== undefined && persistedValue === undefined) {
      setVariable(element.props.variableName, { value: element.props.defaultValue });
    }
  }, [element.props.variableName, element.props.defaultValue, persistedValue]);

  const handleChange = (text: string) => {
    setValue(text);
    if (element.props.variableName) {
      setVariable(element.props.variableName, { value: text });
    }
  };

  return (
    <TextInput
      value={value}
      onChangeText={handleChange}
      placeholder={element.props.placeholder}
      placeholderTextColor={element.props.placeholderColor ?? theme.colors.text.tertiary}
      keyboardType={element.props.keyboardType ?? "default"}
      returnKeyType={element.props.returnKeyType ?? "done"}
      autoCapitalize={element.props.autoCapitalize ?? "sentences"}
      secureTextEntry={element.props.secureTextEntry ?? false}
      maxLength={element.props.maxLength}
      multiline={element.props.multiline ?? false}
      numberOfLines={element.props.numberOfLines}
      editable={element.props.editable ?? true}
      style={{
        flex: element.props.flex,
        flexShrink: element.props.flexShrink,
        flexGrow: element.props.flexGrow,
        alignSelf: element.props.alignSelf,
        width: dim(element.props.width),
        height: dim(element.props.height),
        minWidth: element.props.minWidth,
        maxWidth: element.props.maxWidth,
        minHeight: element.props.minHeight,
        maxHeight: element.props.maxHeight,
        opacity: element.props.opacity,
        overflow: element.props.overflow,
        margin: element.props.margin,
        marginHorizontal: element.props.marginHorizontal,
        marginVertical: element.props.marginVertical,
        backgroundColor: element.props.backgroundColor ?? theme.colors.neutral.lowest,
        borderWidth: element.props.borderWidth ?? 1,
        borderRadius: element.props.borderRadius ?? 8,
        borderColor: element.props.borderColor ?? theme.colors.neutral.low,
        color: element.props.color ?? theme.colors.text.primary,
        fontSize: element.props.fontSize ?? theme.typography.textStyles.body.fontSize,
        fontWeight: element.props.fontWeight as any,
        fontFamily: element.props.fontFamily,
        lineHeight: element.props.lineHeight,
        letterSpacing: element.props.letterSpacing,
        textAlign: element.props.textAlign,
        padding: element.props.padding ?? 12,
        paddingHorizontal: element.props.paddingHorizontal,
        paddingVertical: element.props.paddingVertical,
      }}
    />
  );
};
