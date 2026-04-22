import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";

export type IconElementProps = BaseBoxProps & {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  backgroundColor?: string;
};

export const IconElementPropsSchema = BaseBoxPropsSchema.extend({
  name: z.string().min(1, "icon name must not be empty"),
  size: z.number().nonnegative().optional(),
  color: z.string().optional(),
  strokeWidth: z.number().nonnegative().optional(),
  backgroundColor: z.string().optional(),
});
