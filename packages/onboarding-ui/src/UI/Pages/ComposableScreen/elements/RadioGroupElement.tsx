import React, { useEffect, useState } from "react";
import { z } from "zod";
import { View, Text, TouchableOpacity, Image as RNImage, type LayoutChangeEvent } from "react-native";
import { SvgUri } from "react-native-svg";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { UIElement } from "../types";
import { RenderContext, dim } from "./shared";
import { GradientBox } from "./GradientBox";
import { triggerHaptic, type HapticStyle } from "./haptics";

export type RadioGroupElementProps = BaseBoxProps & {
  variableName?: string;
  defaultValue?: string;
  haptic?: HapticStyle;
  gap?: number;
  direction?: "vertical" | "horizontal";
  showTick?: boolean;
  columns?: number;
  itemImageSize?: number;
  itemAlign?: "row" | "column";
  itemDescriptionColor?: string;
  itemDescriptionFontSize?: number;
  items: Array<{
    label: string;
    value: string;
    description?: string;
    imageUrl?: string;
    imageAspectRatio?: number;
    icon?: string;
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
  itemPadding?: number;
  itemPaddingHorizontal?: number;
  itemPaddingVertical?: number;
};

export const RadioGroupElementPropsSchema = BaseBoxPropsSchema.extend({
  variableName: z.string().optional(),
  defaultValue: z.string().optional(),
  haptic: z.enum(["none", "light", "medium", "heavy", "soft", "rigid"]).optional(),
  gap: z.number().optional(),
  direction: z.enum(["vertical", "horizontal"]).optional(),
  showTick: z.boolean().optional(),
  columns: z.number().int().min(1).max(6).optional(),
  itemImageSize: z.number().positive().optional(),
  itemAlign: z.enum(["row", "column"]).optional(),
  itemDescriptionColor: z.string().optional(),
  itemDescriptionFontSize: z.number().optional(),
  items: z.array(z.object({
    label: z.string().trim().min(1, "item label must not be empty"),
    value: z.string().trim().min(1, "item value must not be empty"),
    description: z.string().optional(),
    imageUrl: z.string().optional(),
    imageAspectRatio: z.number().positive().optional(),
    icon: z.string().optional(),
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

const isSvgUrl = (url: string): boolean =>
  url.split(/[?#]/)[0].toLowerCase().endsWith(".svg");

// Renders a per-item image (svg or raster) or a lucide icon. `imageUrl` wins
// over `icon` when both are set. Returns null when neither is provided.
const ItemMedia = ({
  imageUrl,
  icon,
  size,
  aspectRatio,
  color,
}: {
  imageUrl?: string;
  icon?: string;
  size: number;
  aspectRatio?: number;
  color: string;
}): React.ReactElement | null => {
  if (imageUrl) {
    const style = { width: size, height: size / (aspectRatio ?? 1) };
    return isSvgUrl(imageUrl) ? (
      <SvgUri uri={imageUrl} width={style.width} height={style.height} />
    ) : (
      <RNImage source={{ uri: imageUrl }} resizeMode="contain" style={style} />
    );
  }
  if (icon) {
    const icons = require("lucide-react-native");
    const IconComp = icons[icon] as React.ComponentType<{ size?: number; color?: string }> | undefined;
    return IconComp ? <IconComp size={size} color={color} /> : null;
  }
  return null;
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
      triggerHaptic(element.props.haptic);
      setVariable(element.props.variableName, { value, label });
    }
  };

  // `columns` (grid) overrides `direction`: wrapping row with each item sized so
  // N fit per row. Falls back to the direction flow.
  const columns = element.props.columns;
  const gap = element.props.gap ?? 8;
  const isGrid = columns != null && columns > 0;
  const isHorizontal = !isGrid && element.props.direction === "horizontal";
  const itemAlign = element.props.itemAlign ?? "row";
  // Measure the container so grid items get an EXACT pixel width that accounts
  // for the inter-item gaps (gap is px, so a %-only width can't be exact). Until
  // the first layout, fall back to an even %-split estimate (one frame); flexWrap
  // keeps it sane if the estimate is slightly wide.
  const [gridWidth, setGridWidth] = useState(0);
  const gridItemWidth = !isGrid
    ? undefined
    : gridWidth > 0
      ? (gridWidth - gap * (columns - 1)) / columns
      : (`${100 / columns}%` as const);
  const onGridLayout = isGrid
    ? (e: LayoutChangeEvent) => setGridWidth(e.nativeEvent.layout.width)
    : undefined;

  return (
    <GradientBox
      gradient={element.props.backgroundGradient}
      onLayout={onGridLayout}
      style={{
        flexDirection: isGrid || isHorizontal ? "row" : "column",
        flexWrap: isGrid || isHorizontal ? "wrap" : undefined,
        alignSelf: element.props.alignSelf,
        gap,
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

        const media = (
          <ItemMedia
            imageUrl={item.imageUrl}
            icon={item.icon}
            size={element.props.itemImageSize ?? 40}
            aspectRatio={item.imageAspectRatio}
            color={textColor}
          />
        );
        const hasMedia = !!(item.imageUrl || item.icon);

        return (
          <TouchableOpacity
            key={item.value}
            activeOpacity={0.7}
            onPress={() => handleSelect(item.value, item.label)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected, checked: isSelected }}
            accessibilityLabel={item.label}
            style={{
              flexDirection: itemAlign,
              alignItems: "center",
              gap: 12,
              width: gridItemWidth as any,
              backgroundColor: bgColor,
              borderRadius: element.props.itemBorderRadius ?? 8,
              borderWidth: element.props.itemBorderWidth ?? 1,
              borderColor: borderColor,
              padding: element.props.itemPadding ?? (element.props.itemPaddingHorizontal === undefined && element.props.itemPaddingVertical === undefined ? 12 : undefined),
              paddingHorizontal: element.props.itemPaddingHorizontal,
              paddingVertical: element.props.itemPaddingVertical,
            }}
          >
            {element.props.showTick !== false && (
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
            )}
            {hasMedia && media}
            <View style={{ flexShrink: 1, alignItems: itemAlign === "column" ? "center" : "flex-start" }}>
              <Text
                style={{
                  color: textColor,
                  fontSize: element.props.itemFontSize ?? theme.typography.textStyles.body.fontSize,
                  fontWeight: (element.props.itemFontWeight as any) ?? theme.typography.textStyles.body.fontWeight,
                  fontFamily: element.props.itemFontFamily,
                  fontStyle: element.props.itemFontStyle,
                  textAlign: itemAlign === "column" ? "center" : "left",
                }}
              >
                {item.label}
              </Text>
              {item.description ? (
                <Text
                  style={{
                    marginTop: 2,
                    color: element.props.itemDescriptionColor ?? theme.colors.text.secondary,
                    fontSize: element.props.itemDescriptionFontSize ?? 13,
                    textAlign: itemAlign === "column" ? "center" : "left",
                  }}
                >
                  {item.description}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
        );
      })}
    </GradientBox>
  );
};
