import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema, type ShadowOffset, ShadowOffsetSchema } from "./BaseBoxProps";
import { type HapticStyle, HapticStyleSchema } from "../../common.types";

export type CheckboxGroupElementProps = BaseBoxProps & {
  variableName?: string;
  defaultValues?: string[];
  /** Tactile feedback fired on press, before the toggle commits. Maps to expo-haptics ImpactFeedbackStyle. Opt-in; no-op without expo-haptics. */
  haptic?: HapticStyle;
  gap?: number;
  direction?: "vertical" | "horizontal";
  /** Cross-axis alignment of each item's contents (tick ↔ content column). Defaults to "center". */
  itemAlignItems?: "flex-start" | "center" | "flex-end" | "stretch";
  /** Spacing (px) between an item's inner pieces: tick ↔ content, and image ↔ text within the content column. Defaults to 12. */
  itemGap?: number;
  showTick?: boolean;
  /** Tick (checkbox box) placement relative to the label. Defaults to "start". */
  tickPosition?: "start" | "end";
  /** Tick color when the item is unselected (border). Defaults to theme neutral. */
  tickColor?: string;
  /** Tick color when the item is selected (border + fill). Defaults to theme primary. */
  tickSelectedColor?: string;
  /** Corner radius of the tick element. Defaults to 4. */
  tickBorderRadius?: number;
  /** Side length of the tick box in px. Checkmark scales with it. Defaults to 20. */
  tickSize?: number;
  /** Optional per-item image, stacked above the label/sub-label (image → label → subLabel column). */
  items: Array<{
    label?: string;
    value: string;
    subLabel?: string;
    image?: {
      url: string;
      width?: number;
      height?: number;
      aspectRatio?: number;
      resizeMode?: "cover" | "contain" | "stretch" | "center";
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
  /** Sub-label (secondary line) style. Mirrors the label props but for items[].subLabel. */
  itemSubLabelColor?: string;
  itemSelectedSubLabelColor?: string;
  itemSubLabelFontSize?: number;
  itemSubLabelFontWeight?: string;
  itemSubLabelFontFamily?: string;
  itemSubLabelFontStyle?: "normal" | "italic";
  itemPadding?: number;
  itemPaddingHorizontal?: number;
  itemPaddingVertical?: number;
  /** Per-item drop shadow (applied to each checkbox row). iOS uses shadow*; Android uses itemElevation. */
  itemShadowColor?: string;
  itemShadowOffset?: ShadowOffset;
  itemShadowOpacity?: number;
  itemShadowRadius?: number;
  itemElevation?: number;
};

export const CheckboxGroupElementPropsSchema = BaseBoxPropsSchema.extend({
  variableName: z.string().optional(),
  defaultValues: z.array(z.string()).optional(),
  haptic: HapticStyleSchema.optional(),
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
