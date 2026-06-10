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
