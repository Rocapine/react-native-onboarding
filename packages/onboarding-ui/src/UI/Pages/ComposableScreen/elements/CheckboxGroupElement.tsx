import React, { useEffect } from "react";
import { z } from "zod";
import { View, Text, TouchableOpacity } from "react-native";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import type { UIElement } from "../types";
import { dim, type RenderContext } from "./shared";
import { GradientBox } from "./GradientBox";
import { triggerHaptic, type HapticStyle } from "./haptics";

export type CheckboxGroupElementProps = BaseBoxProps & {
  variableName?: string;
  defaultValues?: string[];
  haptic?: HapticStyle;
  gap?: number;
  direction?: "vertical" | "horizontal";
  showTick?: boolean;
  items: Array<{ label: string; value: string }>;
  itemBackgroundColor?: string;
  itemSelectedBackgroundColor?: string;
  itemBorderColor?: string;
  itemSelectedBorderColor?: string;
  itemBorderRadius?: number;
  itemBorderWidth?: number;
  itemColor?: string;
  itemSelectedColor?: string;
  itemFontSize?: number;
  itemFontWeight?: string;
  itemFontFamily?: string;
  itemFontStyle?: "normal" | "italic";
  itemPadding?: number;
  itemPaddingHorizontal?: number;
  itemPaddingVertical?: number;
  tickSize?: number;
  tickBorderWidth?: number;
  tickBorderRadius?: number;
  tickBorderColor?: string;
  tickSelectedBorderColor?: string;
  tickBackgroundColor?: string;
  tickSelectedBackgroundColor?: string;
  tickColor?: string;
};

export const CheckboxGroupElementPropsSchema = BaseBoxPropsSchema.extend({
  variableName: z.string().optional(),
  defaultValues: z.array(z.string()).optional(),
  haptic: z.enum(["none", "light", "medium", "heavy", "soft", "rigid"]).optional(),
  gap: z.number().optional(),
  direction: z.enum(["vertical", "horizontal"]).optional(),
  showTick: z.boolean().optional(),
  items: z.array(z.object({ label: z.string().trim().min(1, "item label must not be empty"), value: z.string().trim().min(1, "item value must not be empty") })).min(1, "items must not be empty"),
  itemBackgroundColor: z.string().optional(),
  itemSelectedBackgroundColor: z.string().optional(),
  itemBorderColor: z.string().optional(),
  itemSelectedBorderColor: z.string().optional(),
  itemBorderRadius: z.number().optional(),
  itemBorderWidth: z.number().optional(),
  itemColor: z.string().optional(),
  itemSelectedColor: z.string().optional(),
  itemFontSize: z.number().optional(),
  itemFontWeight: z.string().optional(),
  itemFontFamily: z.string().optional(),
  itemFontStyle: z.enum(["normal", "italic"]).optional(),
  itemPadding: z.number().optional(),
  itemPaddingHorizontal: z.number().optional(),
  itemPaddingVertical: z.number().optional(),
  tickSize: z.number().positive().optional(),
  tickBorderWidth: z.number().min(0).optional(),
  tickBorderRadius: z.number().min(0).optional(),
  tickBorderColor: z.string().optional(),
  tickSelectedBorderColor: z.string().optional(),
  tickBackgroundColor: z.string().optional(),
  tickSelectedBackgroundColor: z.string().optional(),
  tickColor: z.string().optional(),
}).superRefine((data, ctx) => {
  const values = data.items.map((i) => i.value);
  const unique = new Set(values);
  if (unique.size !== values.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "item values must be unique", path: ["items"] });
  }
  if (data.defaultValues !== undefined) {
    data.defaultValues.forEach((dv, i) => {
      if (!unique.has(dv)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `defaultValues entry "${dv}" must match one of the item values`, path: ["defaultValues", i] });
      }
    });
  }
});

type CheckboxGroupUIElement = Extract<UIElement, { type: "CheckboxGroup" }>;

type Props = {
  element: CheckboxGroupUIElement;
  ctx: RenderContext;
};

export const CheckboxGroupComponent = ({ element, ctx }: Props): React.ReactElement => {
  const { theme, variables, setVariable } = ctx;
  // The variable stores a JSON-serialised string[] to stay compatible with the string-based variable system.
  const rawValue = element.props.variableName ? variables[element.props.variableName]?.value : undefined;
  const selectedValues: string[] | undefined = (() => {
    if (typeof rawValue !== "string") return undefined;
    try { return JSON.parse(rawValue) as string[]; } catch { return undefined; }
  })();

  useEffect(() => {
    if (element.props.variableName && element.props.defaultValues && selectedValues === undefined) {
      const defaultLabels = element.props.defaultValues.map((dv) => element.props.items.find((i) => i.value === dv)?.label ?? dv);
      setVariable(element.props.variableName, {
        value: JSON.stringify(element.props.defaultValues),
        label: defaultLabels.join(", "),
      });
    }
  }, [element.props.variableName, element.props.defaultValues, element.props.items, selectedValues]);

  const handleToggle = (value: string, label: string) => {
    if (!element.props.variableName) return;
    triggerHaptic(element.props.haptic);
    const current: string[] = selectedValues ?? [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    const nextLabels = next.map((v) => element.props.items.find((i) => i.value === v)?.label ?? v);
    setVariable(element.props.variableName, {
      value: JSON.stringify(next),
      label: nextLabels.join(", "),
    });
  };

  const isHorizontal = element.props.direction === "horizontal";

  return (
    <GradientBox
      gradient={element.props.backgroundGradient}
      style={{
        flexDirection: isHorizontal ? "row" : "column",
        flexWrap: isHorizontal ? "wrap" : undefined,
        alignSelf: element.props.alignSelf,
        gap: element.props.gap ?? 8,
        width: dim(element.props.width),
        height: dim(element.props.height),
        margin: element.props.margin,
        marginHorizontal: element.props.marginHorizontal,
        marginVertical: element.props.marginVertical,
        padding: element.props.padding,
        paddingHorizontal: element.props.paddingHorizontal,
        paddingVertical: element.props.paddingVertical,
        borderWidth: element.props.borderWidth,
        borderRadius: element.props.borderRadius,
        borderColor: element.props.borderColor,
        backgroundColor: element.props.backgroundGradient ? undefined : element.props.backgroundColor,
        opacity: element.props.opacity,
      }}
    >
      {element.props.items.map((item) => {
        const isSelected = (selectedValues ?? []).includes(item.value);
        const bgColor = isSelected
          ? (element.props.itemSelectedBackgroundColor ?? (theme.colors.primary.startsWith("#") ? theme.colors.primary + "1A" : theme.colors.primary))
          : (element.props.itemBackgroundColor ?? "transparent");
        const textColor = isSelected
          ? (element.props.itemSelectedColor ?? theme.colors.primary)
          : (element.props.itemColor ?? theme.colors.text.primary);
        const borderColor = isSelected
          ? (element.props.itemSelectedBorderColor ?? theme.colors.primary)
          : (element.props.itemBorderColor ?? theme.colors.neutral.low);

        return (
          <TouchableOpacity
            key={item.value}
            activeOpacity={0.7}
            onPress={() => handleToggle(item.value, item.label)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSelected }}
            accessibilityLabel={item.label}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              backgroundColor: bgColor,
              borderRadius: element.props.itemBorderRadius ?? 8,
              borderWidth: element.props.itemBorderWidth ?? 1,
              borderColor: borderColor,
              padding: element.props.itemPadding ?? (element.props.itemPaddingHorizontal === undefined && element.props.itemPaddingVertical === undefined ? 12 : undefined),
              paddingHorizontal: element.props.itemPaddingHorizontal,
              paddingVertical: element.props.itemPaddingVertical,
            }}
          >
            {element.props.showTick !== false && (() => {
              const size = element.props.tickSize ?? 20;
              return (
                <View
                  style={{
                    width: size,
                    height: size,
                    borderRadius: element.props.tickBorderRadius ?? 4,
                    borderWidth: element.props.tickBorderWidth ?? 2,
                    borderColor: isSelected
                      ? (element.props.tickSelectedBorderColor ?? theme.colors.primary)
                      : (element.props.tickBorderColor ?? theme.colors.neutral.medium),
                    backgroundColor: isSelected
                      ? (element.props.tickSelectedBackgroundColor ?? theme.colors.primary)
                      : (element.props.tickBackgroundColor ?? "transparent"),
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {isSelected && (
                    <Text
                      style={{
                        color: element.props.tickColor ?? "#fff",
                        fontSize: size * 0.6,
                        fontWeight: "700",
                        lineHeight: size * 0.7,
                      }}
                    >
                      ✓
                    </Text>
                  )}
                </View>
              );
            })()}
            <Text
              style={{
                flexShrink: 1,
                color: textColor,
                fontSize: element.props.itemFontSize ?? theme.typography.textStyles.body.fontSize,
                fontWeight: (element.props.itemFontWeight as any) ?? theme.typography.textStyles.body.fontWeight,
                fontFamily: element.props.itemFontFamily,
                fontStyle: element.props.itemFontStyle,
              }}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </GradientBox>
  );
};
