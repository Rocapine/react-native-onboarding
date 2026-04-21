import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";

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
  items: z.array(z.object({ label: z.string(), value: z.string() })),
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
});
