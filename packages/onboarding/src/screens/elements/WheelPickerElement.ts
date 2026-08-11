import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";

export type WheelPickerItem = { label: string; value: string };

export type WheelPickerRange = {
  min: number;
  max: number;
  step?: number;
  unit?: string;
};

export type WheelPickerElementProps = BaseBoxProps & {
  variableName?: string;
  defaultValue?: string;
  /** Explicit option list. Mutually exclusive with `range`. */
  items?: WheelPickerItem[];
  /** Numeric range that auto-generates options. Mutually exclusive with `items`. */
  range?: WheelPickerRange;
  /** Text color of the wheel items. */
  itemColor?: string;
  /** Font size of the wheel items (iOS `itemStyle`). */
  itemFontSize?: number;
  /** Font family of the wheel items (iOS `itemStyle`). */
  itemFontFamily?: string;
};

// Hard cap on generated range items — guards against runaway ranges
// (e.g. min 0 / max 1e9 / step 0.01) producing millions of <Picker.Item>.
const RANGE_MAX_ITEMS = 1000;

/**
 * Expand a numeric `range` into wheel items. Shared by the UI renderer,
 * default-collection, and schema validation so all three agree on the exact
 * generated value set (and its string formatting).
 */
export function generateWheelPickerRangeItems(range: WheelPickerRange): WheelPickerItem[] {
  const step = range.step ?? 1;
  const items: WheelPickerItem[] = [];
  if (!(step > 0) || range.max < range.min) return items;
  for (let i = 0; i < RANGE_MAX_ITEMS; i++) {
    const raw = range.min + i * step;
    if (raw > range.max + 1e-9) break;
    // Trim float accumulation noise (e.g. 0.30000000000000004 → 0.3).
    const value = Math.round(raw * 1e6) / 1e6;
    const valueStr = String(value);
    const label = range.unit ? `${valueStr} ${range.unit}` : valueStr;
    items.push({ label, value: valueStr });
  }
  return items;
}

/**
 * Resolve the effective item list for a WheelPicker: explicit `items` win,
 * otherwise the numeric `range` is expanded. Returns `[]` when neither is set.
 */
export function resolveWheelPickerItems(props: WheelPickerElementProps): WheelPickerItem[] {
  if (props.items && props.items.length > 0) return props.items;
  if (props.range) return generateWheelPickerRangeItems(props.range);
  return [];
}

const WheelPickerItemSchema = z.object({
  label: z.string().trim().min(1, "item label must not be empty"),
  value: z.string().trim().min(1, "item value must not be empty"),
});

const WheelPickerRangeSchema = z.object({
  min: z.number(),
  max: z.number(),
  step: z.number().positive().optional(),
  unit: z.string().optional(),
});

export const WheelPickerElementPropsSchema = BaseBoxPropsSchema.extend({
  variableName: z.string().optional(),
  defaultValue: z.string().optional(),
  items: z.array(WheelPickerItemSchema).min(1, "items must not be empty").optional(),
  range: WheelPickerRangeSchema.optional(),
  itemColor: z.string().optional(),
  itemFontSize: z.number().optional(),
  itemFontFamily: z.string().optional(),
}).superRefine((data, ctx) => {
  const hasItems = data.items !== undefined;
  const hasRange = data.range !== undefined;
  // Exactly one source must be present — both or neither is ambiguous.
  if (hasItems === hasRange) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "provide exactly one of `items` or `range`",
      path: hasItems ? ["range"] : ["items"],
    });
    return;
  }
  if (hasRange && data.range!.max < data.range!.min) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "range.max must be >= range.min",
      path: ["range", "max"],
    });
    return;
  }
  const values = resolveWheelPickerItems(data as WheelPickerElementProps).map((i) => i.value);
  const unique = new Set(values);
  if (hasItems && unique.size !== values.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "item values must be unique", path: ["items"] });
  }
  if (data.defaultValue !== undefined && !unique.has(data.defaultValue)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "defaultValue must match one of the available values",
      path: ["defaultValue"],
    });
  }
});
