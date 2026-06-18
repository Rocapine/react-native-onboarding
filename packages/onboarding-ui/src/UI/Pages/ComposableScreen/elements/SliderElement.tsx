import React, { useEffect } from "react";
import { z } from "zod";
import { View } from "react-native";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { UIElement } from "../types";
import { RenderContext, dim, buildShadowStyle } from "./shared";
import { GradientBox } from "./GradientBox";

// Optional peer dep — host app installs @react-native-community/slider only when
// using a Slider element. Absent → renders the styled container alone (no thumb),
// mirroring GradientBox's silent fallback rather than throwing.
let NativeSlider: React.ComponentType<any> | undefined;
try {
  NativeSlider = require("@react-native-community/slider").default;
} catch {
  NativeSlider = undefined;
}

export type SliderElementProps = BaseBoxProps & {
  variableName?: string;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  minimumTrackTintColor?: string;
  maximumTrackTintColor?: string;
  thumbTintColor?: string;
  disabled?: boolean;
};

export const SliderElementPropsSchema = BaseBoxPropsSchema.extend({
  variableName: z.string().min(1).optional(),
  defaultValue: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().min(0).optional(),
  minimumTrackTintColor: z.string().optional(),
  maximumTrackTintColor: z.string().optional(),
  thumbTintColor: z.string().optional(),
  disabled: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.min !== undefined && data.max !== undefined && data.min > data.max) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "min must be <= max", path: ["min"] });
  }
});

type SliderUIElement = Extract<UIElement, { type: "Slider" }>;

type Props = {
  element: SliderUIElement;
  ctx: RenderContext;
};

export const SliderElementComponent = ({ element, ctx }: Props): React.ReactElement => {
  const { theme, variables, setVariable } = ctx;
  const { props } = element;

  const min = props.min ?? 0;
  const max = props.max ?? 1;
  const fallback = props.defaultValue ?? min;

  const persisted = props.variableName ? variables[props.variableName]?.value : undefined;
  const value = persisted !== undefined ? parseFloat(persisted) : fallback;

  // Seed the bound variable from defaultValue on mount when unset (kind:"float"
  // so expression-mode setVariable does numeric math, not string concat).
  useEffect(() => {
    if (props.variableName && props.defaultValue !== undefined && persisted === undefined) {
      setVariable(props.variableName, { value: String(props.defaultValue), kind: "float" });
    }
  }, [props.variableName, props.defaultValue, persisted]);

  const handleChange = (next: number) => {
    if (props.variableName) {
      setVariable(props.variableName, { value: String(next), kind: "float" });
    }
  };

  return (
    <GradientBox
      gradient={props.backgroundGradient}
      style={{
        alignSelf: props.alignSelf,
        flex: props.flex,
        flexGrow: props.flexGrow,
        flexShrink: props.flexShrink,
        width: dim(props.width),
        height: dim(props.height),
        minWidth: props.minWidth,
        maxWidth: props.maxWidth,
        minHeight: props.minHeight,
        maxHeight: props.maxHeight,
        margin: props.margin,
        marginHorizontal: props.marginHorizontal,
        marginVertical: props.marginVertical,
        padding: props.padding,
        paddingHorizontal: props.paddingHorizontal,
        paddingVertical: props.paddingVertical,
        borderWidth: props.borderWidth,
        borderRadius: props.borderRadius,
        borderColor: props.borderColor,
        backgroundColor: props.backgroundGradient ? undefined : props.backgroundColor,
        opacity: props.opacity,
        overflow: props.overflow,
        ...buildShadowStyle(props),
      }}
    >
      {NativeSlider ? (
        <NativeSlider
          style={{ width: "100%" }}
          value={value}
          minimumValue={min}
          maximumValue={max}
          step={props.step ?? 0}
          disabled={props.disabled ?? false}
          minimumTrackTintColor={props.minimumTrackTintColor ?? theme.colors.primary}
          maximumTrackTintColor={props.maximumTrackTintColor ?? theme.colors.neutral.low}
          thumbTintColor={props.thumbTintColor ?? theme.colors.primary}
          onValueChange={handleChange}
        />
      ) : (
        <View style={{ height: 40 }} />
      )}
    </GradientBox>
  );
};
