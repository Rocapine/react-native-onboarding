import React, { useEffect } from "react";
import { z } from "zod";
import { View, Text, TouchableOpacity, Image as RNImage } from "react-native";
import { SvgUri } from "react-native-svg";
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
  columns?: number;
  itemImageSize?: number;
  itemAlign?: "row" | "column";
  itemDescriptionColor?: string;
  itemDescriptionFontSize?: number;
  minSelection?: number;
  maxSelection?: number;
  disableAtMax?: boolean;
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

export const CheckboxGroupElementPropsSchema = BaseBoxPropsSchema.extend({
  variableName: z.string().optional(),
  defaultValues: z.array(z.string()).optional(),
  haptic: z.enum(["none", "light", "medium", "heavy", "soft", "rigid"]).optional(),
  gap: z.number().optional(),
  direction: z.enum(["vertical", "horizontal"]).optional(),
  showTick: z.boolean().optional(),
  columns: z.number().int().min(1).max(6).optional(),
  itemImageSize: z.number().positive().optional(),
  itemAlign: z.enum(["row", "column"]).optional(),
  itemDescriptionColor: z.string().optional(),
  itemDescriptionFontSize: z.number().optional(),
  minSelection: z.number().int().min(0).optional(),
  maxSelection: z.number().int().min(1).optional(),
  disableAtMax: z.boolean().optional(),
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
  if (data.defaultValues !== undefined) {
    data.defaultValues.forEach((dv, i) => {
      if (!unique.has(dv)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `defaultValues entry "${dv}" must match one of the item values`, path: ["defaultValues", i] });
      }
    });
  }
  if (data.minSelection !== undefined && data.maxSelection !== undefined && data.maxSelection < data.minSelection) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "maxSelection must be >= minSelection", path: ["maxSelection"] });
  }
});

type CheckboxGroupUIElement = Extract<UIElement, { type: "CheckboxGroup" }>;

type Props = {
  element: CheckboxGroupUIElement;
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
    const current: string[] = selectedValues ?? [];
    const isAdding = !current.includes(value);
    // Enforce maxSelection: block adding beyond the cap. Deselect always allowed.
    if (isAdding && element.props.maxSelection !== undefined && current.length >= element.props.maxSelection) {
      triggerHaptic("rigid");
      return;
    }
    triggerHaptic(element.props.haptic);
    const next = isAdding ? [...current, value] : current.filter((v) => v !== value);
    const nextLabels = next.map((v) => element.props.items.find((i) => i.value === v)?.label ?? v);
    setVariable(element.props.variableName, {
      value: JSON.stringify(next),
      label: nextLabels.join(", "),
    });
  };

  const selectionCount = (selectedValues ?? []).length;
  const atMax = element.props.maxSelection !== undefined && selectionCount >= element.props.maxSelection;

  // `columns` (grid) overrides `direction`: wrapping row with each item sized to
  // a percentage width so N fit per row. Falls back to the direction flow.
  const columns = element.props.columns;
  const gap = element.props.gap ?? 8;
  const isGrid = columns != null && columns > 0;
  const isHorizontal = !isGrid && element.props.direction === "horizontal";
  const itemAlign = element.props.itemAlign ?? "row";
  const gridItemWidth = isGrid ? `${(100 - gap * (columns - 1) / 3) / columns}%` : undefined;

  return (
    <GradientBox
      gradient={element.props.backgroundGradient}
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
        // When `disableAtMax` and the cap is hit, unselected items dim + disable.
        const isCapDisabled = !!element.props.disableAtMax && atMax && !isSelected;

        const hasMedia = !!(item.imageUrl || item.icon);

        return (
          <TouchableOpacity
            key={item.value}
            activeOpacity={0.7}
            disabled={isCapDisabled}
            onPress={() => handleToggle(item.value, item.label)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSelected, disabled: isCapDisabled }}
            accessibilityLabel={item.label}
            style={{
              flexDirection: itemAlign,
              alignItems: "center",
              gap: 12,
              width: gridItemWidth as any,
              opacity: isCapDisabled ? 0.4 : 1,
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
            )}
            {hasMedia && (
              <ItemMedia
                imageUrl={item.imageUrl}
                icon={item.icon}
                size={element.props.itemImageSize ?? 40}
                aspectRatio={item.imageAspectRatio}
                color={textColor}
              />
            )}
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
