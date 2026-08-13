import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";

export type IconElementProps = BaseBoxProps & {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
  fillOpacity?: number;
  backgroundColor?: string;
};

export const IconElementPropsSchema = BaseBoxPropsSchema.extend({
  name: z.string().min(1, "icon name must not be empty"),
  size: z.number().nonnegative().optional(),
  color: z.string().optional(),
  strokeWidth: z.number().nonnegative().optional(),
  fill: z.string().optional(),
  fillOpacity: z.number().min(0).max(1).optional(),
  backgroundColor: z.string().optional(),
});
