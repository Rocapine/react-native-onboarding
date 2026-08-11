import React, { useEffect } from "react";
import { z } from "zod";
import { View, Text, TouchableOpacity } from "react-native";
import { useResolvedFontStyle } from "@rocapine/react-native-onboarding";
import { BaseBoxProps, BaseBoxPropsSchema, type ShadowOffset, ShadowOffsetSchema } from "./BaseBoxProps";
import type { UIElement } from "../types";
import { dim, resolveInheritedFontFamily, buildShadowStyle, type RenderContext } from "./shared";
import { useVariables } from "./VariablesContext";
import { GradientBox } from "./GradientBox";
import { triggerHaptic, type HapticStyle } from "./haptics";
import { type ResizeMode, renderImageSource } from "./imageSource";

export type CheckboxGroupElementProps = BaseBoxProps & {
  variableName?: string;
  defaultValues?: string[];
  haptic?: HapticStyle;
  gap?: number;
  direction?: "vertical" | "horizontal";
  itemAlignItems?: "flex-start" | "center" | "flex-end" | "stretch";
  itemGap?: number;
  showTick?: boolean;
  tickPosition?: "start" | "end";
  tickColor?: string;
  tickSelectedColor?: string;
  tickBorderRadius?: number;
  tickSize?: number;
  items: Array<{
    label?: string;
    value: string;
    subLabel?: string;
    image?: {
      url: string;
      width?: number;
      height?: number;
      aspectRatio?: number;
      resizeMode?: ResizeMode;
      borderRadius?: number;
    };
  }>;
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
  itemSubLabelColor?: string;
  itemSelectedSubLabelColor?: string;
  itemSubLabelFontSize?: number;
  itemSubLabelFontWeight?: string;
  itemSubLabelFontFamily?: string;
  itemSubLabelFontStyle?: "normal" | "italic";
  itemPadding?: number;
  itemPaddingHorizontal?: number;
  itemPaddingVertical?: number;
  itemShadowColor?: string;
  itemShadowOffset?: ShadowOffset;
  itemShadowOpacity?: number;
  itemShadowRadius?: number;
  itemElevation?: number;
};

export const CheckboxGroupElementPropsSchema = BaseBoxPropsSchema.extend({
  variableName: z.string().optional(),
  defaultValues: z.array(z.string()).optional(),
  haptic: z.enum(["none", "light", "medium", "heavy", "soft", "rigid"]).optional(),
  gap: z.number().optional(),
  direction: z.enum(["vertical", "horizontal"]).optional(),
  itemAlignItems: z.enum(["flex-start", "center", "flex-end", "stretch"]).optional(),
  itemGap: z.number().min(0).optional(),
  showTick: z.boolean().optional(),
  tickPosition: z.enum(["start", "end"]).optional(),
  tickColor: z.string().optional(),
  tickSelectedColor: z.string().optional(),
  tickBorderRadius: z.number().min(0).optional(),
  tickSize: z.number().min(1).optional(),
  items: z.array(z.object({
    label: z.string().trim().optional(),
    value: z.string().trim().min(1, "item value must not be empty"),
    subLabel: z.string().trim().optional(),
    image: z.object({
      url: z.string().min(1, "image url must not be empty"),
      width: z.number().min(0).optional(),
      height: z.number().min(0).optional(),
      aspectRatio: z.number().optional(),
      resizeMode: z.enum(["cover", "contain", "stretch", "center"]).optional(),
      borderRadius: z.number().min(0).optional(),
    }).optional(),
  })).min(1, "items must not be empty"),
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
  itemSubLabelColor: z.string().optional(),
  itemSelectedSubLabelColor: z.string().optional(),
  itemSubLabelFontSize: z.number().optional(),
  itemSubLabelFontWeight: z.string().optional(),
  itemSubLabelFontFamily: z.string().optional(),
  itemSubLabelFontStyle: z.enum(["normal", "italic"]).optional(),
  itemPadding: z.number().optional(),
  itemPaddingHorizontal: z.number().optional(),
  itemPaddingVertical: z.number().optional(),
  itemShadowColor: z.string().optional(),
  itemShadowOffset: ShadowOffsetSchema.optional(),
  itemShadowOpacity: z.number().min(0).max(1).optional(),
  itemShadowRadius: z.number().min(0).optional(),
  itemElevation: z.number().min(0).optional(),
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
  const { theme, setVariable } = ctx;
  const { variables } = useVariables();
  // The variable stores a JSON-serialised string[] to stay compatible with the string-based variable system.
  const rawValue = element.props.variableName ? variables[element.props.variableName]?.value : undefined;
  const selectedValues: string[] | undefined = (() => {
    if (typeof rawValue !== "string") return undefined;
    try { return JSON.parse(rawValue) as string[]; } catch { return undefined; }
  })();

  // Resolve item typography once (group-level props apply to every item). Falls
  // back to theme.typography.defaultFontFamily so labels honor the theme font.
  const resolvedFont = useResolvedFontStyle(
    resolveInheritedFontFamily(element.props.itemFontFamily, theme.typography.defaultFontFamily),
    element.props.itemFontWeight,
    element.props.itemFontStyle
  );
  // Sub-label typography resolved once too (hooks must run unconditionally).
  const resolvedSubLabelFont = useResolvedFontStyle(
    resolveInheritedFontFamily(element.props.itemSubLabelFontFamily ?? element.props.itemFontFamily, theme.typography.defaultFontFamily),
    element.props.itemSubLabelFontWeight,
    element.props.itemSubLabelFontStyle
  );

  useEffect(() => {
    if (element.props.variableName && element.props.defaultValues && selectedValues === undefined) {
      const defaultLabels = element.props.defaultValues.map((dv) => element.props.items.find((i) => i.value === dv)?.label ?? dv);
      setVariable(element.props.variableName, {
        value: JSON.stringify(element.props.defaultValues),
        label: defaultLabels.join(", "),
      });
    }
  }, [element.props.variableName, element.props.defaultValues, element.props.items, selectedValues]);

  const handleToggle = (value: string, label?: string) => {
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
        flex: element.props.flex,
        flexGrow: element.props.flexGrow,
        flexShrink: element.props.flexShrink,
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
        const tickColor = isSelected
          ? (element.props.tickSelectedColor ?? theme.colors.primary)
          : (element.props.tickColor ?? theme.colors.neutral.medium);
        const subLabelColor = isSelected
          ? (element.props.itemSelectedSubLabelColor ?? element.props.itemSubLabelColor ?? textColor)
          : (element.props.itemSubLabelColor ?? theme.colors.text.secondary);
        const tickSize = element.props.tickSize ?? 20;
        const hasLabel = !!item.label;
        const hasSubLabel = !!item.subLabel;
        const itemGap = element.props.itemGap ?? 12;

        const imageNode = item.image
          ? renderImageSource(item.image.url, item.image.resizeMode ?? "contain", {
              width: item.image.width,
              height: item.image.height,
              aspectRatio: item.image.aspectRatio,
              borderRadius: item.image.borderRadius,
              overflow: "hidden",
            })
          : null;

        const tickNode = element.props.showTick !== false ? (
          <View
            style={{
              width: tickSize,
              height: tickSize,
              borderRadius: element.props.tickBorderRadius ?? 4,
              borderWidth: 2,
              borderColor: tickColor,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isSelected ? tickColor : "transparent",
            }}
          >
            {isSelected && (
              <Text
                style={{
                  color: "#fff",
                  fontSize: tickSize * 0.6,
                  fontWeight: "700",
                  lineHeight: tickSize * 0.7,
                }}
              >
                ✓
              </Text>
            )}
          </View>
        ) : null;

        // Match text line alignment to itemAlignItems so multi-line label/subLabel
        // center (or right-align) instead of always reading left.
        const itemTextAlign: "left" | "center" | "right" =
          element.props.itemAlignItems === "center" ? "center" :
          element.props.itemAlignItems === "flex-end" ? "right" : "left";

        const textBlock = (hasLabel || hasSubLabel) ? (
          <View style={{ gap: hasLabel && hasSubLabel ? 2 : 0, alignSelf: "stretch" }}>
            {hasLabel && (
              <Text
                style={{
                  color: textColor,
                  fontSize: element.props.itemFontSize ?? theme.typography.textStyles.body.fontSize,
                  fontWeight: resolvedFont.resolvedToVariant
                    ? undefined
                    : ((element.props.itemFontWeight as any) ?? theme.typography.textStyles.body.fontWeight),
                  fontFamily: resolvedFont.fontFamily,
                  fontStyle: element.props.itemFontStyle,
                  textAlign: itemTextAlign,
                }}
              >
                {item.label}
              </Text>
            )}
            {hasSubLabel && (
              <Text
                style={{
                  color: subLabelColor,
                  fontSize: element.props.itemSubLabelFontSize ?? theme.typography.textStyles.caption.fontSize,
                  fontWeight: resolvedSubLabelFont.resolvedToVariant
                    ? undefined
                    : ((element.props.itemSubLabelFontWeight as any) ?? theme.typography.textStyles.caption.fontWeight),
                  fontFamily: resolvedSubLabelFont.fontFamily,
                  fontStyle: element.props.itemSubLabelFontStyle,
                  textAlign: itemTextAlign,
                }}
              >
                {item.subLabel}
              </Text>
            )}
          </View>
        ) : null;

        // Image + label + sub-label stack as a column (image on top). Wrapped so
        // the item row treats it as one flex child (tick ↔ content). When the prop
        // is unset, alignItems stays "stretch" → labels left-align exactly as before.
        const contentNode = (imageNode || textBlock) ? (
          <View
            style={{
              flexShrink: 1,
              flexGrow: 1,
              alignSelf: "stretch",
              gap: itemGap,
              alignItems: element.props.itemAlignItems ?? "stretch",
            }}
          >
            {imageNode}
            {textBlock}
          </View>
        ) : null;

        const tickAtEnd = element.props.tickPosition === "end";

        return (
          <TouchableOpacity
            key={item.value}
            activeOpacity={0.7}
            onPress={() => handleToggle(item.value, item.label)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSelected }}
            accessibilityLabel={item.label ?? item.subLabel ?? item.value}
            style={{
              flexDirection: "row",
              alignItems: element.props.itemAlignItems ?? "center",
              justifyContent: tickAtEnd ? "space-between" : undefined,
              gap: tickNode && contentNode ? itemGap : 0,
              backgroundColor: bgColor,
              borderRadius: element.props.itemBorderRadius ?? 8,
              borderWidth: element.props.itemBorderWidth ?? 1,
              borderColor: borderColor,
              padding: element.props.itemPadding ?? (element.props.itemPaddingHorizontal === undefined && element.props.itemPaddingVertical === undefined ? 12 : undefined),
              paddingHorizontal: element.props.itemPaddingHorizontal,
              paddingVertical: element.props.itemPaddingVertical,
              ...buildShadowStyle({
                shadowColor: element.props.itemShadowColor,
                shadowOffset: element.props.itemShadowOffset,
                shadowOpacity: element.props.itemShadowOpacity,
                shadowRadius: element.props.itemShadowRadius,
                elevation: element.props.itemElevation,
              }),
            }}
          >
            {tickAtEnd ? contentNode : tickNode}
            {tickAtEnd ? tickNode : contentNode}
          </TouchableOpacity>
        );
      })}
    </GradientBox>
  );
};
