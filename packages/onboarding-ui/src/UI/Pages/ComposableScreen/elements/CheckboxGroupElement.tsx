import React, { useEffect } from "react";
import { z } from "zod";
import { View, Text, TouchableOpacity } from "react-native";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { UIElement } from "../types";
import { RenderContext } from "./shared";

export type CheckboxGroupElementProps = BaseBoxProps & {
  variableName?: string;
  defaultValues?: string[];
  gap?: number;
  direction?: "vertical" | "horizontal";
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
  itemPadding?: number;
  itemPaddingHorizontal?: number;
  itemPaddingVertical?: number;
};

export const CheckboxGroupElementPropsSchema = BaseBoxPropsSchema.extend({
  variableName: z.string().optional(),
  defaultValues: z.array(z.string()).optional(),
  gap: z.number().optional(),
  direction: z.enum(["vertical", "horizontal"]).optional(),
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
  itemPadding: z.number().optional(),
  itemPaddingHorizontal: z.number().optional(),
  itemPaddingVertical: z.number().optional(),
}).superRefine((data, ctx) => {
  const values = data.items.map((i) => i.value);
  const unique = new Set(values);
  if (unique.size !== values.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "item values must be unique", path: ["items"] });
  }
  if (data.defaultValues !== undefined) {
    for (const dv of data.defaultValues) {
      if (!unique.has(dv)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `defaultValues entry "${dv}" must match one of the item values`, path: ["defaultValues"] });
      }
    }
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
  const selectedValues: string[] = rawValue ? JSON.parse(rawValue) : undefined;

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
    <View
      accessibilityRole="list"
      style={{
        flexDirection: isHorizontal ? "row" : "column",
        flexWrap: isHorizontal ? "wrap" : undefined,
        alignSelf: element.props.alignSelf,
        gap: element.props.gap ?? 8,
        width: element.props.width,
        height: element.props.height,
        margin: element.props.margin,
        marginHorizontal: element.props.marginHorizontal,
        marginVertical: element.props.marginVertical,
        padding: element.props.padding,
        paddingHorizontal: element.props.paddingHorizontal,
        paddingVertical: element.props.paddingVertical,
        borderWidth: element.props.borderWidth,
        borderRadius: element.props.borderRadius,
        borderColor: element.props.borderColor,
        opacity: element.props.opacity,
      }}
    >
      {element.props.items.map((item) => {
        const isSelected = (selectedValues ?? []).includes(item.value);
        // Note: "+ "15"" appends hex alpha (≈8% opacity) assuming a 6-digit hex primary color.
        const bgColor = isSelected
          ? (element.props.itemSelectedBackgroundColor ?? theme.colors.primary + "15")
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
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                borderWidth: 2,
                borderColor: isSelected ? theme.colors.primary : theme.colors.neutral.medium,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isSelected ? theme.colors.primary : "transparent",
              }}
            >
              {isSelected && (
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: "700",
                    lineHeight: 14,
                  }}
                >
                  ✓
                </Text>
              )}
            </View>
            <Text
              style={{
                flexShrink: 1,
                color: textColor,
                fontSize: element.props.itemFontSize ?? theme.typography.textStyles.body.fontSize,
                fontWeight: (element.props.itemFontWeight as any) ?? theme.typography.textStyles.body.fontWeight,
                fontFamily: element.props.itemFontFamily,
              }}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};
