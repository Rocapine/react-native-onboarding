import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";

export type IconElementProps = BaseBoxProps & {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export const IconElementPropsSchema = BaseBoxPropsSchema.extend({
  name: z.string(),
  size: z.number().optional(),
  color: z.string().optional(),
  strokeWidth: z.number().optional(),
});
