import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { type HapticStyle, HapticStyleSchema } from "../../common.types";

export type RadioGroupElementProps = BaseBoxProps & {
  variableName?: string;
  defaultValue?: string;
  /** Tactile feedback fired on press, before the selection commits. Maps to expo-haptics ImpactFeedbackStyle. Opt-in; no-op without expo-haptics. */
  haptic?: HapticStyle;
  gap?: number;
  direction?: "vertical" | "horizontal";
  showTick?: boolean;
  /** Grid layout: N items per row. When set, overrides `direction`. */
  columns?: number;
  /** px; square edge of a per-item `imageUrl` tile image. */
  itemImageSize?: number;
  /** Layout of item image/icon vs text: side-by-side ("row") or stacked tile ("column"). */
  itemAlign?: "row" | "column";
  /** Color of the optional per-item description line. */
  itemDescriptionColor?: string;
  /** Font size of the optional per-item description line. */
  itemDescriptionFontSize?: number;
  items: Array<{
    label: string;
    value: string;
    /** Secondary line rendered under the label. */
    description?: string;
    /** Per-item image tile (asset URL). Wins over `icon` when both set. */
    imageUrl?: string;
    /** Aspect ratio for the item image; default 1 (square). */
    imageAspectRatio?: number;
    /** Lucide icon name; `imageUrl` wins if both are set. */
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
  haptic: HapticStyleSchema.optional(),
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
