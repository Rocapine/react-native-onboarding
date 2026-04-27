import React, { useEffect } from "react";
import { z } from "zod";
import { View, Text, TouchableOpacity } from "react-native";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { UIElement } from "../types";
import { RenderContext, dim } from "./shared";

export type RadioGroupElementProps = BaseBoxProps & {
  variableName?: string;
  defaultValue?: string;
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

export const RadioGroupElementPropsSchema = BaseBoxPropsSchema.extend({
  variableName: z.string().optional(),
  defaultValue: z.string().optional(),
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
  if (data.defaultValue !== undefined && !unique.has(data.defaultValue)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "defaultValue must match one of the item values", path: ["defaultValue"] });
  }
});

type RadioGroupUIElement = Extract<UIElement, { type: "RadioGroup" }>;

type Props = {
  element: RadioGroupUIElement;
  ctx: RenderContext;
};

export const RadioGroupComponent = ({ element, ctx }: Props): React.ReactElement => {
  const { theme, variables, setVariable } = ctx;
  const selectedValue = element.props.variableName ? variables[element.props.variableName]?.value : undefined;

  useEffect(() => {
    if (element.props.variableName && element.props.defaultValue && selectedValue === undefined) {
      const defaultItem = element.props.items.find((i) => i.value === element.props.defaultValue);
      setVariable(element.props.variableName, { value: element.props.defaultValue, label: defaultItem?.label });
    }
  }, [element.props.variableName, element.props.defaultValue, element.props.items, selectedValue]);

  const handleSelect = (value: string, label: string) => {
    if (element.props.variableName) {
      setVariable(element.props.variableName, { value, label });
    }
  };

  const isHorizontal = element.props.direction === "horizontal";

  return (
    <View
      accessibilityRole="radiogroup"
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
        opacity: element.props.opacity,
      }}
    >
      {element.props.items.map((item) => {
        const isSelected = selectedValue === item.value;
        // Note: "+ "15"" appends hex alpha (≈8% opacity) assuming a 6-digit hex primary color.
        // This works for standard hex colors but may produce unexpected results for other color formats.
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
            onPress={() => handleSelect(item.value, item.label)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected, checked: isSelected }}
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
                borderRadius: 10,
                borderWidth: 2,
                borderColor: isSelected ? theme.colors.primary : theme.colors.neutral.medium,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isSelected && (
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: theme.colors.primary,
                  }}
                />
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
